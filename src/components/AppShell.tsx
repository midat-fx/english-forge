import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, BarChart3, BookOpenCheck, CircleUserRound, Dumbbell, LayoutDashboard, LibraryBig, Menu, Mic2, Plus, Settings, X } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useForgeStore } from '../store/useForgeStore'
import { calculateProgress } from '../domain/progress'
import { allProfilesReferencedRecordingIds, clearStorageError, ensureProfilesLoaded, getLastStorageError, retryPendingProfileWrite, STORAGE_ERROR_EVENT } from '../data/profileStorage'
import { loadLexicalCatalogLevel } from '../data/lexicalCatalogLoader'
import { catalogItemIdsFromTags } from '../domain/dailyVocabulary'
import type { CatalogLevel } from '../domain/lexicalCatalog'
import { reconcileAudioLibrary, referencedRecordingIds } from '../lib/audioStorage'
import { cn } from '../lib/utils'
import { localizeStorageError } from '../lib/storageMessages'
import { AddPhraseDialog } from './AddPhraseDialog'
import { Badge } from './ui/Badge'
import { BrandMark } from './BrandMark'
import { Button } from './ui/Button'

const navItems = [
  { to: '/', label: 'Сегодня', icon: LayoutDashboard },
  { to: '/library', label: 'Слова и выражения', icon: LibraryBig },
  { to: '/grammar', label: 'Грамматика', icon: BookOpenCheck },
  { to: '/cards', label: 'Занятие', icon: Dumbbell },
  { to: '/voice', label: 'Слушать и говорить', icon: Mic2 },
  { to: '/progress', label: 'Прогресс', icon: BarChart3 },
]

const catalogLevels: readonly CatalogLevel[] = ['A2', 'B1', 'B2', 'C1']

const pageMeta: Record<string, { title: string; eyebrow: string }> = {
  '/': { title: 'Ваш учебный маршрут', eyebrow: 'Сегодня' },
  '/library': { title: 'Слова и выражения', eyebrow: 'Основная библиотека' },
  '/grammar': { title: 'Грамматика', eyebrow: 'Шаг за шагом' },
  '/phrases': { title: 'Мои слова', eyebrow: 'Личная коллекция' },
  '/cards': { title: 'Занятие', eyebrow: 'Карточки и повторение' },
  '/practice': { title: 'Практика', eyebrow: 'Углублённая отработка' },
  '/voice': { title: 'Слушать и говорить', eyebrow: 'Голосовая студия' },
  '/errors': { title: 'Лаборатория ошибок', eyebrow: 'Повторяющиеся паттерны' },
  '/mission': { title: 'Задание на перенос', eyebrow: 'Применение в реальной речи' },
  '/progress': { title: 'Прогресс', eyebrow: 'Фактическая практика' },
  '/diagnostics': { title: 'Диагностический портфель', eyebrow: 'Listening · speaking · writing' },
  '/settings': { title: 'Настройки', eyebrow: 'Локальная система' },
}

/**
 * One recipe for every rail entry, main list and footer alike. The footer
 * "Настройки" link used to copy only the background of the active state, so an
 * active Settings route lost the mark that every other route got. Sharing the
 * class pair makes that impossible to drift again.
 */
const navItemClass = 'group detent relative flex min-h-tap items-center gap-3 rounded-[3px] px-3 text-sm font-medium text-secondary hover:bg-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus'
const navItemActiveClass = 'bg-elevated text-primary'

/**
 * Slip-level inline notice: paper laid on the sheet, coloured bracket down the
 * binding edge. The bracket colour is NOT part of the shared recipe: rubric
 * marks a destructive/blocked state only, and «требует внимания» is amber. A
 * red bracket under an amber heading puts two inks in one slip.
 */
const alertClass = 'relative mb-5 flex items-start gap-3 overflow-hidden rounded-[2px] border border-border bg-elevated p-4 pl-5 text-sm text-secondary shadow-[var(--lift-2)] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-[""]'
const alertBracketWarning = 'before:bg-amber'
const alertBracketBlocking = 'before:bg-rubric'
const alertCloseClass = 'grid size-tap shrink-0 place-items-center rounded-[3px] text-muted transition-colors hover:bg-recess hover:text-primary'

export function AppShell() {
  const location = useLocation()
  const [addOpen, setAddOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [storageError, setStorageError] = useState(getLastStorageError())
  const [mediaWarning, setMediaWarning] = useState('')
  const [catalogWarning, setCatalogWarning] = useState('')
  const [catalogRetry, setCatalogRetry] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const mobileNavRef = useRef<HTMLElement>(null)
  const mediaReconciledRef = useRef(false)
  const catalogReconciledSignatureRef = useRef('')
  const data = useForgeStore(useShallow((state) => ({
    phrases: state.phrases,
    skillStates: state.skillStates,
    reviews: state.reviews,
    errors: state.errors,
    missions: state.missions,
    speakingAttempts: state.speakingAttempts,
    listeningClips: state.listeningClips,
    preferences: state.preferences,
  })))
  const reconcileCatalogReadiness = useForgeStore((state) => state.reconcileCatalogReadiness)
  const catalogPhrases = data.phrases
  const { catalogSignature, catalogLevelsKey } = useMemo(() => {
    const taggedPhrases = catalogPhrases.filter((phrase) => catalogItemIdsFromTags(phrase.tags).length > 0)
    return {
      catalogSignature: taggedPhrases
        .map((phrase) => `${phrase.id}:${phrase.cefr}:${catalogItemIdsFromTags(phrase.tags).sort().join(',')}:${phrase.tags.includes('catalog-personal-enrichment') ? 'personal' : 'bundled'}`)
        .sort()
        .join('|'),
      catalogLevelsKey: catalogLevels.filter((level) => taggedPhrases.some((phrase) => phrase.cefr === level)).join(','),
    }
  }, [catalogPhrases])
  const reconciliationDataRef = useRef(data)
  reconciliationDataRef.current = data
  const progress = calculateProgress(data)
  const meta = pageMeta[location.pathname] ?? pageMeta['/']

  const runMediaReconciliation = useCallback(async () => {
    try {
      // Reconcile against every profile's referenced recordings, not just the
      // active one — the recording store is shared, so a single-profile view
      // would delete other learners' audio.
      await ensureProfilesLoaded()
      const referenced = new Set([...allProfilesReferencedRecordingIds(), ...referencedRecordingIds(reconciliationDataRef.current)])
      const result = await reconcileAudioLibrary(referenced)
      const messages: string[] = []
      if (result.failed) messages.push(`Не удалось удалить локальные аудиофайлы без ссылок: ${result.failed}. Приложение повторит попытку при следующем запуске или после нажатия кнопки ниже.`)
      if (result.missing) messages.push(`У ссылок на записи нет локальных аудиофайлов: ${result.missing}. Учебные данные сохранены; удалите соответствующую активность или восстановите аудио на этом устройстве.`)
      setMediaWarning(messages.join(' '))
    } catch {
      setMediaWarning('Не удалось проверить локальную аудиотеку. Повторите попытку кнопкой ниже.')
    }
  }, [])

  useEffect(() => {
    if (mediaReconciledRef.current) return
    mediaReconciledRef.current = true
    void runMediaReconciliation()
  }, [runMediaReconciliation])

  useEffect(() => {
    if (!catalogSignature || catalogReconciledSignatureRef.current === catalogSignature) return
    catalogReconciledSignatureRef.current = catalogSignature
    const levels = catalogLevels.filter((level) => catalogLevelsKey.split(',').includes(level))
    let cancelled = false
    void Promise.all(levels.map((level) => loadLexicalCatalogLevel(level)))
      .then(() => {
        if (cancelled) return
        reconcileCatalogReadiness()
        setCatalogWarning('')
      })
      .catch(() => {
        if (cancelled) return
        catalogReconciledSignatureRef.current = ''
        setCatalogWarning('Не удалось сверить ранее добавленные карточки с текущей редакцией учебного каталога. Активная практика для них не изменена; повторите проверку.')
      })
    return () => {
      cancelled = true
      if (catalogReconciledSignatureRef.current === catalogSignature) catalogReconciledSignatureRef.current = ''
    }
  }, [catalogLevelsKey, catalogRetry, catalogSignature, reconcileCatalogReadiness])

  useEffect(() => {
    headingRef.current?.focus()
    setMobileOpen(false)
  }, [location.key, location.pathname, location.search])

  useEffect(() => {
    let gPressed = false
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        setAddOpen(true)
        return
      }
      if (typing) return
      if (event.key.toLowerCase() === 'g') {
        gPressed = true
        window.setTimeout(() => { gPressed = false }, 800)
        return
      }
      if (gPressed) {
        const map: Record<string, string> = { d: '/', w: '/library', a: '/grammar', p: '/practice', v: '/voice', r: '/progress', s: '/settings' }
        const path = map[event.key.toLowerCase()]
        if (path) window.location.hash = `#${path}`
        gPressed = false
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const previousFocus = document.activeElement as HTMLElement | null
    const drawer = mobileNavRef.current
    const focusable = () => [...(drawer?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [])]
    focusable()[0]?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMobileOpen(false); return }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', trap)
    return () => {
      window.removeEventListener('keydown', trap)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [mobileOpen])

  useEffect(() => {
    const handler = (event: Event) => setStorageError((event as CustomEvent<string>).detail)
    window.addEventListener(STORAGE_ERROR_EVENT, handler)
    return () => window.removeEventListener(STORAGE_ERROR_EVENT, handler)
  }, [])

  const nav = (
    <>
      <div className="flex min-h-bar items-center justify-between rule-double px-5">
        <BrandMark />
        <button className="grid size-tap place-items-center rounded-[3px] text-muted hover:bg-elevated hover:text-primary lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Закрыть навигацию"><X className="size-5" /></button>
      </div>
      <nav aria-label="Основная навигация" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => cn(navItemClass, isActive && navItemActiveClass)}>
            {({ isActive }) => <>{isActive && <span aria-hidden="true" className="bracket-in absolute inset-y-2 left-0 w-[3px] bg-rubric" />}<Icon className={cn('size-[18px] shrink-0', isActive ? 'text-rubric' : 'text-muted group-hover:text-secondary')} /><span className="min-w-0 truncate">{label}</span>{to === '/cards' && progress.due > 0 && <Badge tone="amber" className="ml-auto px-2 py-0.5">{progress.due}</Badge>}</>}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border p-3 shadow-[0_-1px_0_var(--paper-hi)]">
        <NavLink to="/settings" className={({ isActive }) => cn(navItemClass, isActive && navItemActiveClass)}>
          {({ isActive }) => <>{isActive && <span aria-hidden="true" className="bracket-in absolute inset-y-2 left-0 w-[3px] bg-rubric" />}<Settings className={cn('size-[18px] shrink-0', isActive ? 'text-rubric' : 'text-muted group-hover:text-secondary')} /><span>Настройки</span></>}
        </NavLink>
        {/* Static, exactly as before the redesign: this slip reports the route,
            it is not a profile switcher. Only the typographic register changed. */}
        <div className="mt-2 flex min-h-tap items-center gap-3 rounded-[3px] px-3 py-3">
          <CircleUserRound className="size-8 shrink-0 text-muted" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-primary">Ваш маршрут</p>
            <p className="numeral text-[11px] text-muted">{data.preferences.currentLevel} → {data.preferences.targetLevel}</p>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen min-h-dvh bg-canvas text-primary">
      <a href="#main-content" className="sr-only z-50 rounded-[3px] bg-teal px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Перейти к основному содержимому</a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-rail flex-col border-r border-border bg-sidebar shadow-[inset_-1px_0_0_var(--paper-hi)] lg:flex">{nav}</aside>
      {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button className="animate-fade-in absolute inset-0 bg-black/65" aria-label="Закрыть навигацию" onClick={() => setMobileOpen(false)} /><aside ref={mobileNavRef} role="dialog" aria-modal="true" aria-label="Меню навигации" className="drawer-in relative flex h-screen h-dvh w-[min(86vw,300px)] flex-col border-r border-border bg-sidebar shadow-[inset_-1px_0_0_var(--paper-hi)]">{nav}</aside></div>}

      <div className="lg:pl-rail">
        {/* Solid bg-canvas, not a translucent pane: a see-through header makes every
            measured contrast ratio a guess, and backdrop-filter is a reliable
            scroll regression in WebView2. */}
        <header className="sticky top-0 z-30 flex min-h-bar items-center justify-between gap-4 rule-double bg-canvas px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button className="grid size-tap shrink-0 place-items-center rounded-[3px] border border-border bg-surface text-secondary shadow-[var(--lift-1)] lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Открыть навигацию"><Menu className="size-5" /></button>
            <div className="min-w-0">
              <p className="section-kicker truncate">{meta.eyebrow}</p>
              <h1 ref={headingRef} tabIndex={-1} className="truncate text-h1 font-light tracking-[-0.02em] text-primary outline-none">{meta.title}</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" className="min-w-tap" aria-label="Добавить слово" aria-keyshortcuts="Meta+N Control+N" onClick={() => setAddOpen(true)}><Plus className="size-4" /> <span className="hidden sm:inline">Добавить слово</span></Button>
          </div>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-bench p-4 sm:p-6 lg:p-8">
          {catalogWarning && <div role="alert" className={cn(alertClass, alertBracketWarning)}><AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber" /><div className="min-w-0 flex-1"><p className="font-semibold text-amber">Каталог требует повторной сверки.</p><p className="mt-1 break-words text-xs leading-5">{catalogWarning}</p><Button size="sm" variant="secondary" className="mt-3" onClick={() => { catalogReconciledSignatureRef.current = ''; setCatalogWarning(''); setCatalogRetry((value) => value + 1) }}>Проверить каталог снова</Button></div><button type="button" aria-label="Закрыть предупреждение о каталоге" className={alertCloseClass} onClick={() => setCatalogWarning('')}><X className="size-4" /></button></div>}
          {mediaWarning && <div role="alert" className={cn(alertClass, alertBracketWarning)}><AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber" /><div className="min-w-0 flex-1"><p className="font-semibold text-amber">Локальная аудиотека требует внимания.</p><p className="mt-1 break-words text-xs leading-5">{mediaWarning}</p><Button size="sm" variant="secondary" className="mt-3" onClick={() => void runMediaReconciliation()}>Проверить аудио снова</Button></div><button type="button" aria-label="Закрыть предупреждение об аудио" className={alertCloseClass} onClick={() => setMediaWarning('')}><X className="size-4" /></button></div>}
          {storageError && <div role="alert" className={cn(alertClass, alertBracketBlocking)}><AlertTriangle className="mt-0.5 size-5 shrink-0 text-rubric" /><div className="min-w-0 flex-1"><p className="font-semibold text-rubric">Локальный профиль не удалось сохранить или восстановить.</p><p className="mt-1 break-words text-xs leading-5">{localizeStorageError(storageError)} До успешной повторной попытки приложение использует безопасные данные в памяти.</p><Button size="sm" variant="secondary" className="mt-3" onClick={() => void retryPendingProfileWrite().then((saved) => { if (saved) setStorageError('') })}>Повторить сохранение</Button></div><button type="button" aria-label="Закрыть предупреждение о профиле" className={alertCloseClass} onClick={() => { clearStorageError(); setStorageError('') }}><X className="size-4" /></button></div>}
          {/* Keyed on the pathname so every route entry replays sheet-in, with the
              Suspense boundary INSIDE the animated wrapper — outside it, a lazy
              chunk resolving would remount the wrapper and play the entrance a
              second time. */}
          <div key={location.pathname} className="sheet-in">
            <Suspense fallback={<div role="status" aria-live="polite" className="py-16 text-center text-sm text-secondary">Открываем страницу…</div>}>
              <Outlet context={{ openAddPhrase: () => setAddOpen(true) }} />
            </Suspense>
          </div>
        </main>
      </div>
      <AddPhraseDialog open={addOpen} onOpenChange={setAddOpen} />
      <div aria-live="polite" aria-atomic="true" className="sr-only" />
    </div>
  )
}

export interface AppOutletContext { openAddPhrase: () => void }
