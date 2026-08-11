import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DemoModeIndicator } from '@/components/DemoModeIndicator';
import { APP_ENV } from '@/config/environment';
import { isFeatureEnabled } from '@/features';
import { NotFound } from './NotFound';
import {
  Welcome,
  WelcomeName,
  PracticeHome,
  EditPractices,
  Reminders,
  SessionSelect,
  SessionReview,
  PracticePlayer,
  LevelUp,
  Journey,
} from '@/screens';
import { InstrumentationPage } from '@/screens/InstrumentationPage';
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

          {isFeatureEnabled('sessions') && (
            <>
              <Route path="/session/select" element={
                <PostOnboardingGuard><SessionSelect /></PostOnboardingGuard>
              } />
              <Route path="/session/review" element={
                <PostOnboardingGuard><SessionReview /></PostOnboardingGuard>
              } />
            </>
          )}

          <Route path="/player" element={
            <PostOnboardingGuard><PracticePlayer /></PostOnboardingGuard>
          } />
          <Route path="/post-practice" element={
            <PostOnboardingGuard><Navigate to="/practice-home" replace /></PostOnboardingGuard>
          } />

          {isFeatureEnabled('journey') && (
            <>
              <Route path="/level-up" element={
                <PostOnboardingGuard><LevelUp /></PostOnboardingGuard>
              } />
              <Route path="/journey" element={
                <PostOnboardingGuard><Journey /></PostOnboardingGuard>
              } />
            </>
          )}

          {APP_ENV === 'lab' && (
            <Route path="/instrumentation" element={<InstrumentationPage />} />
          )}

          <Route path="/app-home" element={<Navigate to="/practice-home" replace />} />
          <Route path="/onboarding/*" element={<Navigate to="/welcome" replace />} />
          <Route path="/practice-so-far" element={<NotFound />} />
          <Route path="/settings" element={<NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
