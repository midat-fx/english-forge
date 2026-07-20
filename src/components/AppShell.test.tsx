import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { createEmptyData } from '../data/seed'
import { loadLexicalCatalogLevel } from '../data/lexicalCatalogLoader'
import { clearStorageError, STORAGE_ERROR_EVENT } from '../data/profileStorage'
import { reconcileAudioLibrary } from '../lib/audioStorage'
import { useForgeStore } from '../store/useForgeStore'
import { AppShell } from './AppShell'

vi.mock('../lib/audioStorage', async () => {
  const actual = await vi.importActual<typeof import('../lib/audioStorage')>('../lib/audioStorage')
  return { ...actual, reconcileAudioLibrary: vi.fn() }
})

vi.mock('../data/lexicalCatalogLoader', async () => {
  const actual = await vi.importActual<typeof import('../data/lexicalCatalogLoader')>('../data/lexicalCatalogLoader')
  return { ...actual, loadLexicalCatalogLevel: vi.fn(actual.loadLexicalCatalogLevel) }
})

const canonicalReconcileCatalogReadiness = useForgeStore.getState().reconcileCatalogReadiness

function SamePathHandoff() {
  const navigate = useNavigate()
  return <button type="button" onClick={() => navigate('/grammar?lesson=b1-past-perfect')}>Открыть другой урок</button>
}

function renderShell(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route path="errors" element={<p>Маршрут ошибок</p>} />
          <Route path="grammar" element={<SamePathHandoff />} />
          <Route path="mission" element={<p>Маршрут задания</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppShell Russian service copy', () => {
  beforeEach(() => {
    clearStorageError()
    useForgeStore.setState({ ...createEmptyData(), reconcileCatalogReadiness: canonicalReconcileCatalogReadiness })
    vi.mocked(reconcileAudioLibrary).mockResolvedValue({ removed: 0, failed: 1, missing: 2 })
  })

  afterEach(() => {
    cleanup()
    clearStorageError()
    vi.clearAllMocks()
  })

  it('uses Russian page metadata and audio reconciliation messages', async () => {
    renderShell('/errors')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Лаборатория ошибок')
    expect(screen.getByText('Повторяющиеся паттерны')).toBeInTheDocument()
    expect(await screen.findByText(/Не удалось удалить локальные аудиофайлы без ссылок: 1/)).toBeInTheDocument()
    expect(screen.getByText(/У ссылок на записи нет локальных аудиофайлов: 2/)).toBeInTheDocument()
  })

  it('does not expose an English storage error to the Russian interface', () => {
    vi.mocked(reconcileAudioLibrary).mockResolvedValue({ removed: 0, failed: 0, missing: 0 })
    renderShell('/mission')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Задание на перенос')
    act(() => {
      window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: 'Profile writes are locked until you import a backup.' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Запись профиля заблокирована')
    expect(screen.getByRole('alert')).not.toHaveTextContent('Profile writes are locked')
  })

  it('announces a same-path query handoff by focusing the route heading', async () => {
    vi.mocked(reconcileAudioLibrary).mockResolvedValue({ removed: 0, failed: 0, missing: 0 })
    const user = userEvent.setup()
    renderShell('/grammar?lesson=a2-present-simple')

    await user.click(screen.getByRole('button', { name: 'Открыть другой урок' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Грамматика' })).toHaveFocus()
  })

  it('loads every tagged CEFR chunk before invoking state-only catalog reconciliation', async () => {
    const levels = ['A2', 'B1', 'B2', 'C1'] as const
    const phraseIds = levels.map((level) => useForgeStore.getState().addPhrase({
      canonical: `startup reconciliation ${level}`,
      meaning: 'test meaning',
      context: `This startup reconciliation ${level} phrase has a complete context.`,
      source: 'Test', kind: 'collocation', cefr: level, register: ['neutral'], tags: [], note: '',
    }).id!)
    const reconcile = vi.fn()
    useForgeStore.setState((state) => ({
      phrases: state.phrases.map((phrase) => {
        const index = phraseIds.indexOf(phrase.id)
        return index < 0 ? phrase : { ...phrase, tags: [`catalog-item:startup-${levels[index].toLowerCase()}`] }
      }),
      reconcileCatalogReadiness: reconcile,
    }))

    renderShell('/errors')

    // This dynamic-imports the whole lexical catalog: the waiting budget comes from
    // asyncUtilTimeout in src/test/setup.ts, not from a per-call-site override.
    await waitFor(() => {
      for (const level of levels) expect(loadLexicalCatalogLevel).toHaveBeenCalledWith(level)
      expect(reconcile).toHaveBeenCalledWith()
    })
  })
})
