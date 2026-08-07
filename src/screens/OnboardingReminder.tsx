import { useNavigate } from 'react-router-dom';
import { Button } from '@/components';
import { useAppStore } from '@/stores/appStore';
import { requestNotificationPermission, scheduleReminders } from '@/services/notifications';
import { precacheInvocation } from '@/services/audio';

export function OnboardingReminder() {
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const navigate = useNavigate();

  const finish = async (reminderEnabled: boolean) => {
    if (reminderEnabled) {
      const permission = await requestNotificationPermission();
      await completeOnboarding(permission === 'granted');
      if (permission === 'granted') {
        await scheduleReminders();
      }
    } else {
      await completeOnboarding(false);
    }
    await precacheInvocation();
    navigate('/practice-home', { replace: true });
  };

  return (
    <div className="flex flex-col h-full px-6 justify-center">
      <div className="text-center mb-12">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0D8A7A" strokeWidth="2">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
        </div>
        <h1 className="font-serif text-[28px] font-semibold leading-tight mb-3">
          Get a practice reminder when it's time to practice
        </h1>
        <p className="text-secondary">You can change the time later.</p>
      </div>
      <div className="flex flex-col gap-3 safe-bottom pb-4">
        <Button fullWidth onClick={() => finish(true)}>
          Allow reminders
        </Button>
        <Button fullWidth variant="text" onClick={() => finish(false)}>
          Not now
        </Button>
      </div>
    </div>
  );
}
