import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BackHeader, Toggle, BottomSheet, TimePicker, Button } from '@/components';
import { useAppStore } from '@/stores/appStore';
import { formatTimeDisplay } from '@/utils/dates';
import {
  requestNotificationPermission,
  getNotificationPermission,
  scheduleReminders,
} from '@/services/notifications';
import { precacheInvocation } from '@/services/audio';

export function Reminders() {
  const navigate = useNavigate();
  const location = useLocation();
  const firstSetup = (location.state as { firstSetup?: boolean })?.firstSetup ?? false;
  const reminders = useAppStore((s) => s.reminders);
  const setReminder = useAppStore((s) => s.setReminder);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<1 | 2 | 3>(1);
  const [selectedTime, setSelectedTime] = useState('06:00');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [permission, setPermission] = useState(getNotificationPermission());

  useEffect(() => {
    const check = () => setPermission(getNotificationPermission());
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, []);

  const needsPermission = permission !== 'granted';

  const openTimeSheet = (id: 1 | 2 | 3) => {
    const existing = reminders.find((r) => r.id === id);
    setEditingId(id);
    setSelectedTime(existing?.time ?? '06:00');
    setSheetOpen(true);
  };

  const handleCardTap = (id: 1 | 2 | 3) => {
    openTimeSheet(id);
  };

  const handleToggle = async (id: 1 | 2 | 3, enabled: boolean) => {
    if (enabled) {
      openTimeSheet(id);
    } else {
      const existing = reminders.find((r) => r.id === id);
      await setReminder(id, existing?.time ?? '06:00', false);
      await scheduleReminders();
    }
  };

  const handleConfirmTime = async () => {
    await setReminder(editingId, selectedTime, true);
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

  const handleEnableNotifications = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted') {
      setShowConfirmation(true);
      await scheduleReminders();
      setTimeout(() => setShowConfirmation(false), 2500);
    }
  };

  const handleFinishSetup = async () => {
    const r1 = reminders.find((r) => r.id === 1);
    await completeOnboarding(r1?.enabled ?? false);
    await precacheInvocation();
    navigate('/practice-home', { replace: true });
  };

  return (
    <div className="h-full flex flex-col bg-page">
      <BackHeader
        title="Practice reminders"
        onBack={() => navigate(firstSetup ? '/practices/edit' : '/practice-home')}
      />
      <div className="px-4 flex-1">
        <p className="text-label text-secondary mb-6">
          Up to three reminders for your practice.
        </p>

        {needsPermission && !showConfirmation && (
          <div className="bg-card rounded-[14px] p-4 mb-6">
            <p className="text-body mb-3">
              Turn on notifications to receive your reminders
            </p>
            <Button variant="secondary" fullWidth onClick={handleEnableNotifications}>
              Turn on
            </Button>
          </div>
        )}

        {showConfirmation && (
          <div className="bg-primary/10 rounded-[14px] p-4 mb-6 text-center text-body text-primary">
            Reminders are on
          </div>
        )}

        {reminders.map((reminder) => (
          <button
            key={reminder.id}
            type="button"
            onClick={() => handleCardTap(reminder.id)}
            className="flex items-center justify-between w-full py-4 border-b border-hairline text-left"
          >
            <div>
              <p className="text-body">Reminder {reminder.id}</p>
              {reminder.enabled && (
                <p className="text-label text-primary mt-0.5">{formatTimeDisplay(reminder.time)}</p>
              )}
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <Toggle
                checked={reminder.enabled}
                onChange={(enabled) => handleToggle(reminder.id, enabled)}
              />
            </div>
          </button>
        ))}
      </div>

      {firstSetup && (
        <div className="px-4 safe-bottom pb-4">
          <Button fullWidth onClick={handleFinishSetup}>
            Continue
          </Button>
        </div>
      )}

      <BottomSheet open={sheetOpen} onClose={handleDismissSheet} title="When should we remind you?">
        <TimePicker value={selectedTime} onChange={setSelectedTime} />
        <Button fullWidth className="mt-4" onClick={handleConfirmTime}>
          Confirm
        </Button>
      </BottomSheet>
    </div>
  );
}
