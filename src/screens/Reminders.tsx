import { useState, useEffect, useMemo } from 'react';
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
import {
  PRACTICE_REMINDER_CONFIG,
  getPracticeReminderIds,
} from '@/utils/practiceReminders';

const SESSION_PROMPT_KEY = 'notification_prompt_raised';

const DENIED_INSTRUCTIONS_PLACEHOLDER =
  'TBD-PM: Open your browser settings, find this site under Notifications, and allow notifications. ' +
  'On iPhone: Settings → Safari → [site] → Notifications. On Android Chrome: site lock icon → Permissions → Notifications.';

function applyPermissionResult(
  result: NotificationPermission,
  setPermission: (p: NotificationPermission | 'unsupported') => void,
  setShowConfirmation: (v: boolean) => void,
) {
  setPermission(result);
  void updateParticipantFields({ notification_permission: result });
  if (result === 'granted') {
    setShowConfirmation(true);
    void scheduleReminders();
    setTimeout(() => setShowConfirmation(false), 2500);
  }
}

function requestPermissionFromGesture(
  setPermission: (p: NotificationPermission | 'unsupported') => void,
  setShowConfirmation: (v: boolean) => void,
) {
  if (!('Notification' in window)) return;
  const result = Notification.requestPermission();
  if (typeof result === 'object' && result !== null && 'then' in result) {
    void (result as Promise<NotificationPermission>).then((r) =>
      applyPermissionResult(r, setPermission, setShowConfirmation),
    );
  } else {
    applyPermissionResult(result as NotificationPermission, setPermission, setShowConfirmation);
  }
}

export function Reminders() {
  const navigate = useNavigate();
  const location = useLocation();
  const firstSetup = (location.state as { firstSetup?: boolean })?.firstSetup ?? false;
  const reminders = useAppStore((s) => s.reminders);
  const instances = useAppStore((s) => s.instances);
  const profile = useAppStore((s) => s.profile);
  const setReminder = useAppStore((s) => s.setReminder);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  const inSetup = firstSetup || !profile?.onboardingComplete;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<ReminderKey>(1);
  const [selectedTime, setSelectedTime] = useState('06:00');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [permission, setPermission] = useState(getNotificationPermission());

  const genericReminders = reminders.filter((r) => r.kind === 'generic');

  const practiceReminderIds = useMemo(
    () => getPracticeReminderIds(instances),
    [instances],
  );

  useEffect(() => {
    const check = () => setPermission(getNotificationPermission());
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    if (sessionStorage.getItem(SESSION_PROMPT_KEY)) return;
    sessionStorage.setItem(SESSION_PROMPT_KEY, '1');
    requestPermissionFromGesture(setPermission, setShowConfirmation);
  }, []);

  const needsPermission = permission !== 'granted';
  const permissionDenied = permission === 'denied';

  const openTimeSheet = (id: ReminderKey) => {
    const existing = reminders.find((r) => r.id === id);
    setEditingId(id);
    setSelectedTime(existing?.time ?? '06:00');
    setSheetOpen(true);
  };

  const handleToggle = async (id: ReminderKey, enabled: boolean) => {
    const config = typeof id === 'string' ? PRACTICE_REMINDER_CONFIG[id] : undefined;

    if (config?.lockedTime) {
      await setReminder(id, config.time, enabled);
      track(enabled ? 'reminder_set' : 'reminder_disabled', {
        slot: null,
        kind: 'practice',
        practice_id: id,
        time_local: config.time,
        was_enabled_before: !enabled,
      });
      await scheduleReminders();
      return;
    }

    const existing = reminders.find((r) => r.id === id);
    if (enabled) {
      openTimeSheet(id);
    } else {
      await setReminder(id, existing?.time ?? '06:00', false);
      track('reminder_disabled', {
        slot: typeof id === 'number' ? id : null,
        kind: 'generic',
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
    if (permissionDenied) return;
    requestPermissionFromGesture(setPermission, setShowConfirmation);
  };

  const handleFinishSetup = async () => {
    const r1 = reminders.find((r) => r.id === 1);
    await completeOnboarding(r1?.enabled ?? false);
    if (isFeatureEnabled('invocation')) {
      await precacheInvocation();
    }
    navigate('/practice-home', { replace: true });
  };

  return (
    <div className="h-full flex flex-col bg-page">
      <BackHeader
        title="Practice reminders"
        onBack={() => {
          if (inSetup) {
            navigate('/practices/edit', { state: { firstSetup: true } });
          } else {
            navigate('/practice-home');
          }
        }}
      />
      <div className="px-4 flex-1">
        <p className="text-label text-secondary mb-6">
          Set up to three reminders for your practice.
        </p>

        {needsPermission && !showConfirmation && (
          <div className="bg-card rounded-[14px] p-4 mb-6">
            {permissionDenied ? (
              <>
                <p className="text-body mb-3">Notifications are blocked in your browser.</p>
                <p className="text-label text-secondary">{DENIED_INSTRUCTIONS_PLACEHOLDER}</p>
              </>
            ) : (
              <>
                <p className="text-body mb-3">
                  Turn on notifications to receive your reminders
                </p>
                <Button variant="secondary" fullWidth onClick={handleEnableNotifications}>
                  Allow
                </Button>
              </>
            )}
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

        {practiceReminderIds.map((practiceId) => {
          const reminder = reminders.find((r) => r.id === practiceId);
          const config = PRACTICE_REMINDER_CONFIG[practiceId];
          const name = getPractice(practiceId)?.name ?? practiceId;
          if (!reminder || !config) return null;

          return (
            <div
              key={practiceId}
              className="flex items-center justify-between w-full py-4 border-b border-hairline"
            >
              <div>
                <p className="text-body">{name}</p>
                <p className="text-label text-secondary mt-0.5">
                  {reminder.enabled ? formatTimeDisplay(config.time) : 'Off'}
                </p>
              </div>
              <Toggle
                checked={reminder.enabled}
                onChange={(enabled) => handleToggle(practiceId as ReminderKey, enabled)}
              />
            </div>
          );
        })}
      </div>

      {inSetup && (
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
