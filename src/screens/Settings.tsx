import { useNavigate } from 'react-router-dom';
import { BackHeader } from '@/components';

export function Settings() {
  const navigate = useNavigate();

  return (
    <div className="h-full">
      <BackHeader title="Settings" />
      <div className="px-4">
        <button
          onClick={() => navigate('/reminders')}
          className="w-full flex items-center justify-between py-4 border-b border-border"
        >
          <span className="font-medium">Practice reminders</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
