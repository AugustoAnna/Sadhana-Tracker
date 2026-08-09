import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DemoModeIndicator } from '@/components/DemoModeIndicator';
import { isFeatureEnabled } from '@/features';
import { FeatureGate } from './FeatureGate';
import {
  Welcome,
  WelcomeName,
  PracticeHome,
  EditPractices,
  Reminders,
  SessionSelect,
  SessionReview,
  PracticePlayer,
  PostPractice,
  LevelUp,
  Journey,
  PracticeSoFar,
} from '@/screens';
import {
  LandingRedirect,
  WelcomeGuard,
  PostOnboardingGuard,
  SetupGuard,
} from './guards';

export function AppRouter() {
  return (
    <BrowserRouter>
      <div className="h-full max-w-lg mx-auto bg-page shadow-lg relative overflow-hidden">
        {isFeatureEnabled('mandala') && <DemoModeIndicator />}
        <Routes>
          <Route path="/" element={<LandingRedirect />} />

          <Route path="/welcome" element={
            <WelcomeGuard><Welcome /></WelcomeGuard>
          } />
          <Route path="/welcome/name" element={
            <WelcomeGuard><WelcomeName /></WelcomeGuard>
          } />

          <Route path="/practice-home" element={
            <PostOnboardingGuard><PracticeHome /></PostOnboardingGuard>
          } />
          <Route path="/practices/edit" element={
            <SetupGuard><EditPractices /></SetupGuard>
          } />
          <Route path="/reminders" element={
            <SetupGuard><Reminders /></SetupGuard>
          } />
          <Route path="/practice-so-far" element={
            <PostOnboardingGuard><PracticeSoFar /></PostOnboardingGuard>
          } />

          <Route path="/session/select" element={
            <FeatureGate feature="sessions">
              <PostOnboardingGuard><SessionSelect /></PostOnboardingGuard>
            </FeatureGate>
          } />
          <Route path="/session/review" element={
            <FeatureGate feature="sessions">
              <PostOnboardingGuard><SessionReview /></PostOnboardingGuard>
            </FeatureGate>
          } />
          <Route path="/player" element={
            <PostOnboardingGuard><PracticePlayer /></PostOnboardingGuard>
          } />
          <Route path="/post-practice" element={
            <PostOnboardingGuard><PostPractice /></PostOnboardingGuard>
          } />
          <Route path="/level-up" element={
            <FeatureGate feature="journey">
              <PostOnboardingGuard><LevelUp /></PostOnboardingGuard>
            </FeatureGate>
          } />
          <Route path="/journey" element={
            <FeatureGate feature="journey">
              <PostOnboardingGuard><Journey /></PostOnboardingGuard>
            </FeatureGate>
          } />

          <Route path="/app-home" element={<Navigate to="/practice-home" replace />} />
          <Route path="/onboarding/*" element={<Navigate to="/welcome" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
