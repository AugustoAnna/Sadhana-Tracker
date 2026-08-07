import { BrowserRouter, Routes, Route } from 'react-router-dom';
import {
  OnboardingName,
  OnboardingStatus,
  OnboardingReminder,
  AppHome,
  PracticeHome,
  EditPractices,
  Settings,
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
} from './guards';

export function AppRouter() {
  return (
    <BrowserRouter>
      <div className="h-full max-w-lg mx-auto bg-cream shadow-lg relative overflow-hidden">
        <Routes>
          <Route path="/" element={<LandingRedirect />} />

          <Route path="/onboarding/name" element={
            <NameGuard><OnboardingName /></NameGuard>
          } />
          <Route path="/onboarding/status" element={
            <OnboardingGuard><OnboardingStatus /></OnboardingGuard>
          } />
          <Route path="/onboarding/reminder" element={
            <OnboardingGuard><OnboardingReminder /></OnboardingGuard>
          } />

          <Route path="/app-home" element={
            <PostOnboardingGuard><AppHome /></PostOnboardingGuard>
          } />
          <Route path="/practice-home" element={
            <PostOnboardingGuard><PracticeHome /></PostOnboardingGuard>
          } />
          <Route path="/practices/edit" element={
            <PostOnboardingGuard><EditPractices /></PostOnboardingGuard>
          } />
          <Route path="/settings" element={
            <PostOnboardingGuard><Settings /></PostOnboardingGuard>
          } />
          <Route path="/reminders" element={
            <PostOnboardingGuard><Reminders /></PostOnboardingGuard>
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
