import { useNavigate } from 'react-router-dom';
import { BackHeader, WeekProgressGrid, ProgressStatBoxes } from '@/components';
import { useAppStore } from '@/stores/appStore';

export function PracticeSoFar() {
  const navigate = useNavigate();
  const logs = useAppStore((s) => s.logs);

  return (
    <div className="h-full overflow-y-auto pb-8 bg-page">
      <BackHeader title="My Practice Progress" onBack={() => navigate('/practice-home')} />
      <div className="px-4">
        <ProgressStatBoxes logs={logs} />
        <WeekProgressGrid logs={logs} showLegend />
      </div>
    </div>
  );
}
