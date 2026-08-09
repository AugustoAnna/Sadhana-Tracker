import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DemoModeIndicator } from '@/components/DemoModeIndicator';
import {
  OnboardingName,
  OnboardingStatus,
  OnboardingReminder,
  OnboardingTrackerIntro,
  OnboardingType,
  OnboardingDuration,
  AppHome,
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
  OnboardingGuard,
  NameGuard,
  PostOnboardingGuard,
  MeditatorSetupGuard,
} from './guards';

export function AppRouter() {
  return (
    <BrowserRouter>
      <div className="h-full max-w-lg mx-auto bg-page shadow-lg relative overflow-hidden">
        <DemoModeIndicator />
        <Routes>
          <Route path="/" element={<LandingRedirect />} />

          <Route path="/onboarding/name" element={
            <NameGuard><OnboardingName /></NameGuard>
          } />
          <Route path="/onboarding/reminder" element={
            <OnboardingGuard><OnboardingReminder /></OnboardingGuard>
          } />
          <Route path="/onboarding/status" element={
            <OnboardingGuard><OnboardingStatus /></OnboardingGuard>
          } />
          <Route path="/onboarding/tracker-intro" element={
            <OnboardingGuard><OnboardingTrackerIntro /></OnboardingGuard>
          } />
          <Route path="/onboarding/type" element={
            <OnboardingGuard><OnboardingType /></OnboardingGuard>
          } />
          <Route path="/onboarding/duration" element={
            <OnboardingGuard><OnboardingDuration /></OnboardingGuard>
          } />

          <Route path="/app-home" element={
            <PostOnboardingGuard><AppHome /></PostOnboardingGuard>
          } />
          <Route path="/practice-home" element={
            <PostOnboardingGuard><PracticeHome /></PostOnboardingGuard>
          } />
          <Route path="/practices/edit" element={
            <MeditatorSetupGuard><EditPractices /></MeditatorSetupGuard>
          } />
          <Route path="/reminders" element={
            <MeditatorSetupGuard><Reminders /></MeditatorSetupGuard>
          } />
          <Route path="/session/select" element={
            <PostOnboardingGuard><SessionSelect /></PostOnboardingGuard>
          } />
          <Route path="/session/review" element={
            <PostOnboardingGuard><SessionReview /></PostOnboardingGuard>
          } />
          <Route path="/player" element={
            <PostOnboardingGuard><PracticePlayer /></PostOnboardingGuard>
          } />
          <Route path="/post-practice" element={
            <PostOnboardingGuard><PostPractice /></PostOnboardingGuard>
          } />
          <Route path="/level-up" element={
            <PostOnboardingGuard><LevelUp /></PostOnboardingGuard>
          } />
          <Route path="/journey" element={
            <PostOnboardingGuard><Journey /></PostOnboardingGuard>
          } />
          <Route path="/practice-so-far" element={
            <PostOnboardingGuard><PracticeSoFar /></PostOnboardingGuard>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
