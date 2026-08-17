import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import { Button } from './Button';

export function NameBanner() {
  const serverName = useAppStore((s) => s.serverName);
  const bannerTargets = useAppStore((s) => s.bannerTargets);
  const navigate = useNavigate();

  if (!serverName || !bannerTargets?.has(serverName)) return null;

  return (
    <div className="bg-primary/10 rounded-[14px] p-4 mb-4">
      <p className="text-body mb-2">
        Namaskaram {serverName}, we noticed you are not using your real name. So that we can help you, please click the button and add your name.
      </p>
      <Button fullWidth onClick={() => navigate('/name')}>
        Add your name
      </Button>
    </div>
  );
}
