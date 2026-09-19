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
  EditName,
  SignIn,
} from '@/screens';
import { InstrumentationPage } from '@/screens/InstrumentationPage';
import {
  LandingRedirect,
  AuthGuard,
  SignInGuard,
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
          <Route path="/sign-in" element={
            <SignInGuard><SignIn /></SignInGuard>
          } />
          <Route path="/welcome/name" element={
            <AuthGuard><WelcomeGuard><WelcomeName /></WelcomeGuard></AuthGuard>
          } />

          <Route path="/practice-home" element={
            <AuthGuard><PostOnboardingGuard><PracticeHome /></PostOnboardingGuard></AuthGuard>
          } />
          <Route path="/practices/edit" element={
            <AuthGuard><SetupGuard><EditPractices /></SetupGuard></AuthGuard>
          } />
          <Route path="/reminders" element={
            <AuthGuard><SetupGuard><Reminders /></SetupGuard></AuthGuard>
          } />
          <Route path="/name" element={
            <AuthGuard><PostOnboardingGuard><EditName /></PostOnboardingGuard></AuthGuard>
          } />

          {isFeatureEnabled('sessions') && (
            <>
              <Route path="/session/select" element={
                <AuthGuard><PostOnboardingGuard><SessionSelect /></PostOnboardingGuard></AuthGuard>
              } />
              <Route path="/session/review" element={
                <AuthGuard><PostOnboardingGuard><SessionReview /></PostOnboardingGuard></AuthGuard>
              } />
            </>
          )}

          <Route path="/player" element={
            <AuthGuard><PostOnboardingGuard><PracticePlayer /></PostOnboardingGuard></AuthGuard>
          } />
          <Route path="/post-practice" element={
            <AuthGuard><PostOnboardingGuard><Navigate to="/practice-home" replace /></PostOnboardingGuard></AuthGuard>
          } />

          {isFeatureEnabled('journey') && (
            <>
              <Route path="/level-up" element={
                <AuthGuard><PostOnboardingGuard><LevelUp /></PostOnboardingGuard></AuthGuard>
              } />
              <Route path="/journey" element={
                <AuthGuard><PostOnboardingGuard><Journey /></PostOnboardingGuard></AuthGuard>
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
