import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BackHeader, Toggle, BottomSheet, TimePicker, Button } from '@/components';
import { useAppStore } from '@/stores/appStore';
import { formatTimeDisplay } from '@/utils/dates';
import {
  requestNotificationPermission,
  getNotificationPermission,
  scheduleReminders,
} from '@/services/notifications';

export function Reminders() {
  const navigate = useNavigate();
  const location = useLocation();
  const firstSetup = (location.state as { firstSetup?: boolean })?.firstSetup ?? false;
  const reminders = useAppStore((s) => s.reminders);
  const setReminder = useAppStore((s) => s.setReminder);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<1 | 2 | 3>(1);
  const [selectedTime, setSelectedTime] = useState('06:00');

  const permission = getNotificationPermission();
  const needsPermission = permission !== 'granted';

  const handleToggle = async (id: 1 | 2 | 3, enabled: boolean) => {
    if (enabled) {
      setEditingId(id);
      const existing = reminders.find((r) => r.id === id);
      setSelectedTime(existing?.time ?? '06:00');
      setSheetOpen(true);
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

  const handleDismissSheet = () => {
    setSheetOpen(false);
  };

  const handleEnableNotifications = async () => {
    await requestNotificationPermission();
  };

  return (
    <div className="h-full">
      <BackHeader title="Practice Reminders" onBack={() => navigate(firstSetup ? '/practices/edit' : '/settings')} />
      <div className="px-4">
        {needsPermission && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm mb-3">
              Enable notifications to receive practice reminders, even when the app is closed.
            </p>
            <Button variant="secondary" fullWidth onClick={handleEnableNotifications}>
              Enable notifications
            </Button>
          </div>
        )}

        {reminders.map((reminder) => (
          <div key={reminder.id} className="flex items-center justify-between py-4 border-b border-border">
            <div>
              <p className="font-medium">Reminder {reminder.id}</p>
              {reminder.enabled && (
                <p className="text-sm text-primary">{formatTimeDisplay(reminder.time)}</p>
              )}
            </div>
            <Toggle
              checked={reminder.enabled}
              onChange={(enabled) => handleToggle(reminder.id, enabled)}
            />
          </div>
        ))}
      </div>

      {firstSetup && (
        <div className="px-4 mt-6 safe-bottom pb-4">
          <Button fullWidth onClick={() => navigate('/practice-home')}>
            Continue to practices
          </Button>
        </div>
      )}

      <BottomSheet open={sheetOpen} onClose={handleDismissSheet} title="Select a time">
        <TimePicker value={selectedTime} onChange={setSelectedTime} />
        <p className="text-sm text-secondary text-center mt-4 mb-2">Repeats: Every day</p>
        <Button fullWidth className="mt-4" onClick={handleConfirmTime}>
          Set Time
        </Button>
      </BottomSheet>
    </div>
  );
}
