import { useNavigate } from 'react-router-dom';
import { Button } from '@/components';
import { OnboardingLayout } from '@/components/OnboardingLayout';
import { useAppStore } from '@/stores/appStore';
import { requestNotificationPermission, scheduleReminders } from '@/services/notifications';

export function OnboardingReminder() {
  const markNotificationPermissionAsked = useAppStore((s) => s.markNotificationPermissionAsked);
  const navigate = useNavigate();

  const handleChoice = async (allow: boolean) => {
    if (allow) {
      const permission = await requestNotificationPermission();
      if (permission === 'granted') {
        await scheduleReminders();
      }
    }
    await markNotificationPermissionAsked();
    navigate('/onboarding/status');
  };

  return (
    <OnboardingLayout showBack backTo="/onboarding/name">
      <div className="flex flex-col justify-center min-h-[60vh] px-2">
        <h1 className="font-serif text-display mb-3">
          A reminder when it's time to practice
        </h1>
        <p className="text-label text-secondary mb-8">
          Practice happens when you decide it does. A daily reminder helps you keep that decision.
        </p>
        <div className="flex flex-col gap-3">
          <Button fullWidth onClick={() => handleChoice(true)}>
            Allow reminders
          </Button>
          <Button fullWidth variant="text" onClick={() => handleChoice(false)}>
            Not now
          </Button>
        </div>
      </div>
    </OnboardingLayout>
  );
}
