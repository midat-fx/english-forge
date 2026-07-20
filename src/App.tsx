import { lazy, Suspense, useEffect, useSyncExternalStore } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ProfilePicker } from './components/ProfilePicker'
import { getProfilesSnapshot, markProfileChosen, subscribeProfiles } from './data/profileStorage'
import { useForgeStore } from './store/useForgeStore'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const ErrorLabPage = lazy(() => import('./pages/ErrorLabPage').then((module) => ({ default: module.ErrorLabPage })))
const MissionPage = lazy(() => import('./pages/MissionPage').then((module) => ({ default: module.MissionPage })))
const PhraseBankPage = lazy(() => import('./pages/PhraseBankPage').then((module) => ({ default: module.PhraseBankPage })))
const PracticePage = lazy(() => import('./pages/PracticePage').then((module) => ({ default: module.PracticePage })))
const ProgressPage = lazy(() => import('./pages/ProgressPage').then((module) => ({ default: module.ProgressPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const VoiceLabPage = lazy(() => import('./pages/VoiceLabPage').then((module) => ({ default: module.VoiceLabPage })))
const PlacementPage = lazy(() => import('./pages/PlacementPage').then((module) => ({ default: module.PlacementPage })))
const VocabularyLibraryPage = lazy(() => import('./pages/VocabularyLibraryPage').then((module) => ({ default: module.VocabularyLibraryPage })))
const GrammarAcademyPage = lazy(() => import('./pages/GrammarAcademyPage').then((module) => ({ default: module.GrammarAcademyPage })))
const SkillsDiagnosticPage = lazy(() => import('./pages/SkillsDiagnosticPage').then((module) => ({ default: module.SkillsDiagnosticPage })))

function LearningRoutes() {
  const placementCompleted = useForgeStore((state) => Boolean(state.preferences.placementCompletedAt))
  const theme = useForgeStore((state) => state.preferences.theme)
  const reducedMotion = useForgeStore((state) => state.preferences.reducedMotion)
  const createProfile = useForgeStore((state) => state.createProfile)
  const switchProfile = useForgeStore((state) => state.switchProfile)
  const registry = useSyncExternalStore(subscribeProfiles, getProfilesSnapshot, getProfilesSnapshot)
  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      root.classList.toggle('light', !dark)
      root.classList.toggle('reduce-motion', reducedMotion)
    }
    applyTheme()
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [reducedMotion, theme])
  // Offer a profile picker on launch so a shared copy lets a friend start their own
  // profile. A solo learner who has finished the diagnostic auto-skips this on launch
  // (see loadContainer) but can still reopen it from the sidebar switcher.
  if (!registry.chosen && registry.profiles.some((profile) => profile.placementCompleted)) {
    return (
      <ProfilePicker
        profiles={registry.profiles}
        onSelect={(id) => switchProfile(id).then(markProfileChosen)}
        onCreate={(name) => createProfile(name).then(markProfileChosen)}
      />
    )
  }
  if (!placementCompleted) return <PlacementPage />
  return (
    <Routes>
      <Route path="level-test" element={<PlacementPage />} />
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="library" element={<VocabularyLibraryPage />} />
        <Route path="grammar" element={<GrammarAcademyPage />} />
        <Route path="phrases" element={<PhraseBankPage />} />
        <Route path="practice" element={<PracticePage />} />
        <Route path="voice" element={<VoiceLabPage />} />
        <Route path="errors" element={<ErrorLabPage />} />
        <Route path="mission" element={<MissionPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="diagnostics" element={<SkillsDiagnosticPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={<div role="status" aria-live="polite" className="grid min-h-screen min-h-dvh place-items-center bg-canvas text-sm text-secondary">Открываем рабочее пространство…</div>}>
        <LearningRoutes />
      </Suspense>
    </HashRouter>
  )
}
