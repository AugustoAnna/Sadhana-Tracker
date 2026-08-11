import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BackHeader, Toggle, BottomSheet, TimePicker, Button } from '@/components';
import { useAppStore } from '@/stores/appStore';
import { formatTimeDisplay } from '@/utils/dates';
import {
  getNotificationPermission,
  scheduleReminders,
} from '@/services/notifications';
import { precacheInvocation } from '@/services/audio';
import { isFeatureEnabled } from '@/features';
import { track } from '@/services/instrumentation';
import { updateParticipantFields } from '@/services/sync';
import type { ReminderKey } from '@/types';
import { getPractice } from '@/data/catalogue';

export function Reminders() {
  const navigate = useNavigate();
  const location = useLocation();
  const firstSetup = (location.state as { firstSetup?: boolean })?.firstSetup ?? false;
  const reminders = useAppStore((s) => s.reminders);
  const instances = useAppStore((s) => s.instances);
  const setReminder = useAppStore((s) => s.setReminder);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<ReminderKey>(1);
  const [selectedTime, setSelectedTime] = useState('06:00');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [permission, setPermission] = useState(getNotificationPermission());

  const genericReminders = reminders.filter((r) => r.kind === 'generic');
  const presenceReminder = reminders.find((r) => r.id === 'sadhguru-presence');
  const hasPresencePractice = instances.some((i) => i.practiceId === 'sadhguru-presence');

  useEffect(() => {
    const check = () => setPermission(getNotificationPermission());
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, []);

  const needsPermission = permission !== 'granted';

  const openTimeSheet = (id: ReminderKey) => {
    const existing = reminders.find((r) => r.id === id);
    setEditingId(id);
    setSelectedTime(existing?.time ?? (id === 'sadhguru-presence' ? '18:20' : '06:00'));
    setSheetOpen(true);
  };

  const handleToggle = async (id: ReminderKey, enabled: boolean) => {
    const existing = reminders.find((r) => r.id === id);
    if (enabled) {
      openTimeSheet(id);
    } else {
      await setReminder(id, existing?.time ?? '06:00', false);
      track('reminder_disabled', {
        slot: typeof id === 'number' ? id : null,
        kind: id === 'sadhguru-presence' ? 'practice' : 'generic',
        time_local: existing?.time,
      });
      await scheduleReminders();
    }
  };

  const handleConfirmTime = async () => {
    const existing = reminders.find((r) => r.id === editingId);
    await setReminder(editingId, selectedTime, true);
    track('reminder_set', {
      slot: typeof editingId === 'number' ? editingId : null,
      kind: editingId === 'sadhguru-presence' ? 'practice' : 'generic',
      practice_id: editingId === 'sadhguru-presence' ? 'sadhguru-presence' : null,
      time_local: selectedTime,
      was_enabled_before: existing?.enabled ?? false,
    });
    setSheetOpen(false);
    await scheduleReminders();
  };

  const handleDismissSheet = async () => {
    const existing = reminders.find((r) => r.id === editingId);
    if (!existing?.enabled) {
      await setReminder(editingId, selectedTime, false);
    }
    setSheetOpen(false);
  };

  const handleEnableNotifications = () => {
    if (!('Notification' in window)) return;

    const applyResult = async (result: NotificationPermission) => {
      setPermission(result);
      await updateParticipantFields({ notification_permission: result });
      if (result === 'granted') {
        setShowConfirmation(true);
        await scheduleReminders();
        setTimeout(() => setShowConfirmation(false), 2500);
      }
    };

    const result = Notification.requestPermission();
    if (typeof result === 'object' && result !== null && 'then' in result) {
      void (result as Promise<NotificationPermission>).then(applyResult);
    } else {
      void applyResult(result as NotificationPermission);
    }
  };

  const handleFinishSetup = async () => {
    const r1 = reminders.find((r) => r.id === 1);
    await completeOnboarding(r1?.enabled ?? false);
    if (isFeatureEnabled('invocation')) {
      await precacheInvocation();
    }
    navigate('/practice-home', { replace: true });
  };

  const presenceName = getPractice('sadhguru-presence')?.name ?? "Sadhguru's Presence";

  return (
    <div className="h-full flex flex-col bg-page">
      <BackHeader
        title="Practice reminders"
        onBack={() => navigate(firstSetup ? '/practices/edit' : '/practice-home')}
      />
      <div className="px-4 flex-1">
        <p className="text-label text-secondary mb-6">
          Set up to three reminders for your practice.
        </p>

        {needsPermission && !showConfirmation && (
          <div className="bg-card rounded-[14px] p-4 mb-6">
            <p className="text-body mb-3">
              Turn on notifications to receive your reminders
            </p>
            <Button variant="secondary" fullWidth onClick={handleEnableNotifications}>
              Allow
            </Button>
          </div>
        )}

        {showConfirmation && (
          <div className="bg-primary/10 rounded-[14px] p-4 mb-6 text-center text-body text-primary">
            Reminders are on
          </div>
        )}

        {genericReminders.map((reminder) => (
          <button
            key={reminder.id}
            type="button"
            onClick={() => openTimeSheet(reminder.id)}
            className="flex items-center justify-between w-full py-4 border-b border-hairline text-left"
          >
            <div>
              <p className="text-body">Reminder {reminder.id}</p>
              <p className="text-label text-secondary mt-0.5">
                {reminder.enabled ? formatTimeDisplay(reminder.time) : 'Off'}
              </p>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <Toggle
                checked={reminder.enabled}
                onChange={(enabled) => handleToggle(reminder.id, enabled)}
              />
            </div>
          </button>
        ))}

        {hasPresencePractice && presenceReminder && (
          <button
            type="button"
            onClick={() => openTimeSheet('sadhguru-presence')}
            className="flex items-center justify-between w-full py-4 border-b border-hairline text-left"
          >
            <div>
              <p className="text-body">{presenceName}</p>
              <p className="text-label text-secondary mt-0.5">
                {presenceReminder.enabled ? formatTimeDisplay(presenceReminder.time) : 'Off'}
              </p>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <Toggle
                checked={presenceReminder.enabled}
                onChange={(enabled) => handleToggle('sadhguru-presence', enabled)}
              />
            </div>
          </button>
        )}
      </div>

      {firstSetup && (
        <div className="px-4 safe-bottom pb-4">
          <Button fullWidth onClick={handleFinishSetup}>
            Done
          </Button>
        </div>
      )}

      <BottomSheet open={sheetOpen} onClose={handleDismissSheet} title="Pick a time">
        <TimePicker value={selectedTime} onChange={setSelectedTime} />
        <Button fullWidth className="mt-4" onClick={handleConfirmTime}>
          Set time
        </Button>
      </BottomSheet>
    </div>
  );
}
