import { Navigate } from 'react-router-dom';
import { isFeatureEnabled, type FeatureKey } from '@/features';

export function FeatureGate({
  feature,
  children,
}: {
  feature: FeatureKey;
  children: React.ReactNode;
}) {
  if (!isFeatureEnabled(feature)) {
    return <Navigate to="/practice-home" replace />;
  }
  return <>{children}</>;
}
