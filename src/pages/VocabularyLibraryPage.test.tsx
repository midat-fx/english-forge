import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { catalogItemTag, localDayKey } from '../domain/dailyVocabulary'
import { loadLexicalCatalogLevel } from '../data/lexicalCatalogLoader'
import { PERSONAL_CATALOG_ENRICHMENT_TAG } from '../domain/lexicalCatalog'
import { useForgeStore } from '../store/useForgeStore'
import { VocabularyLibraryPage } from './VocabularyLibraryPage'

describe('vocabulary library daily assignment', () => {
  beforeEach(async () => { await useForgeStore.getState().resetToDemo() })
  afterEach(cleanup)

  it('renders one library heading and explains the active/reference split', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><VocabularyLibraryPage /></MemoryRouter>)

    expect(screen.getAllByRole('heading', { name: 'Большой словарь без перегрузки.' })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: /^A2/ }))
    expect(await screen.findByText(/Уровень A2: .*готовы к активному курсу/)).toBeInTheDocument()
    const reference = (await loadLexicalCatalogLevel('A2')).find((item) => item.activationReady !== true)!
    await user.type(screen.getByLabelText('Поиск по библиотеке'), reference.expression)
    const referenceBadges = await screen.findAllByText('Справочник')
    const referenceButtons = referenceBadges.map((badge) => badge.closest('article')?.querySelector<HTMLButtonElement>('button[aria-label^="Сохранить"]'))
    expect(referenceButtons.length).toBeGreaterThan(0)
    expect(referenceButtons.every((button) => button && !button.disabled && button.textContent?.includes('Сохранить и дополнить'))).toBe(true)
  })

  it('saves a reference row personally without changing the current Daily assignment', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><VocabularyLibraryPage /></MemoryRouter>)
    await waitFor(() => expect(useForgeStore.getState().dailyVocabularyAssignment).not.toBeNull())
    const beforeAssignment = structuredClone(useForgeStore.getState().dailyVocabularyAssignment)
    const beforeAssignments = structuredClone(useForgeStore.getState().dailyVocabularyAssignments)

    await user.click(screen.getByRole('button', { name: /^A2/ }))
    const reference = (await loadLexicalCatalogLevel('A2')).find((item) => item.activationReady !== true)!
    await user.type(screen.getByLabelText('Поиск по библиотеке'), reference.expression)
    const actions = await screen.findAllByRole('button', { name: /Сохранить «.+» и дополнить в моих словах/ })
    await user.click(actions[0])

    const saved = useForgeStore.getState().phrases.find((phrase) => phrase.tags.includes(PERSONAL_CATALOG_ENRICHMENT_TAG))
    expect(saved).toBeDefined()
    expect(saved?.activationError).toBeUndefined()
    expect(saved?.meaning).toContain(' · ')
    expect(saved?.examples.length).toBeGreaterThan(0)
    expect(useForgeStore.getState().dailyVocabularyAssignment).toEqual(beforeAssignment)
    expect(useForgeStore.getState().dailyVocabularyAssignments).toEqual(beforeAssignments)
    expect(screen.getAllByText(/Первые пять шагов доступны; для шага 6 добавьте личный пример вашей ошибки/).length).toBeGreaterThan(0)
  })

  it('keeps the current-level daily pack when the browse level changes', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><VocabularyLibraryPage /></MemoryRouter>)

    await waitFor(() => expect(useForgeStore.getState().dailyVocabularyAssignment).not.toBeNull())
    const assignment = structuredClone(useForgeStore.getState().dailyVocabularyAssignment)
    const currentLevel = useForgeStore.getState().preferences.currentLevel
    expect(assignment?.level).toBe(currentLevel)

    await user.click(screen.getByRole('button', { name: /^B1/ }))

    expect(screen.getByText(`Ежедневный набор · ${currentLevel}`)).toBeInTheDocument()
    expect(useForgeStore.getState().dailyVocabularyAssignment).toEqual(assignment)
  })

  it('does not let the full catalog bypass today’s Discovery and admission gate', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><VocabularyLibraryPage /></MemoryRouter>)
    await waitFor(() => expect(useForgeStore.getState().dailyVocabularyAssignment).not.toBeNull())
    const assignment = useForgeStore.getState().dailyVocabularyAssignment!
    const catalog = await loadLexicalCatalogLevel(assignment.level)
    const outsidePack = catalog.find((item) => item.activationReady === true && !assignment.itemIds.includes(item.id))!

    await user.click(screen.getByRole('button', { name: new RegExp(`^${assignment.level}`) }))
    await user.type(screen.getByLabelText('Поиск по библиотеке'), outsidePack.expression)
    const add = await screen.findByRole('button', { name: `Добавить «${outsidePack.expression}» в личный словарь` })
    expect(add).toBeDisabled()
    expect(add).toHaveAttribute('title', 'Активные карточки добавляются через сегодняшний ежедневный набор.')
  })

  it('requires a correct hidden-meaning retrieval and persists discovery across remounts', async () => {
    const user = userEvent.setup()
    const view = render(<MemoryRouter><VocabularyLibraryPage /></MemoryRouter>)
    await waitFor(() => expect(useForgeStore.getState().dailyVocabularyAssignment).not.toBeNull())
    const assignment = useForgeStore.getState().dailyVocabularyAssignment!
    const catalog = await loadLexicalCatalogLevel(assignment.level)
    const item = catalog.find((entry) => entry.id === assignment.itemIds[0])!
    const group = await screen.findByRole('group', { name: `Значение выражения ${item.expression}` })

    expect(screen.queryByText(item.example)).not.toBeInTheDocument()
    expect(screen.getByText(item.translationRu).closest('button')).not.toBeNull()
    const wrong = within(group).getAllByRole('button').find((button) => button.textContent !== item.translationRu)!
    await user.click(wrong)
    expect(useForgeStore.getState().dailyVocabularyAssignment?.previewedIds ?? []).not.toContain(item.id)
    expect(screen.getByRole('status')).toHaveTextContent(`Коррекция: ${item.translationRu}`)

    await user.click(screen.getByRole('button', { name: 'Повторить без подсказки' }))
    await user.click(within(screen.getByRole('group', { name: `Значение выражения ${item.expression}` })).getByRole('button', { name: item.translationRu }))
    expect(useForgeStore.getState().dailyVocabularyAssignment?.previewedIds).toContain(item.id)
    expect(screen.getByText(item.example)).toBeInTheDocument()

    view.unmount()
    render(<MemoryRouter><VocabularyLibraryPage /></MemoryRouter>)
    expect(await screen.findByText(item.example)).toBeInTheDocument()
    expect(screen.getAllByText('Узнано ✓').length).toBeGreaterThan(0)
  })

  it('persists completion only after all ten discovery answers are correct', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><VocabularyLibraryPage /></MemoryRouter>)
    await waitFor(() => expect(useForgeStore.getState().dailyVocabularyAssignment?.itemIds).toHaveLength(10))
    const assignment = useForgeStore.getState().dailyVocabularyAssignment!
    const catalog = await loadLexicalCatalogLevel(assignment.level)

    for (const id of assignment.itemIds) {
      const item = catalog.find((entry) => entry.id === id)!
      const group = await screen.findByRole('group', { name: `Значение выражения ${item.expression}` })
      await user.click(within(group).getByRole('button', { name: item.translationRu }))
    }

    expect(useForgeStore.getState().dailyVocabularyAssignment?.previewedIds).toHaveLength(10)
    expect(screen.getByText(/угадано 10\/10/i)).toBeInTheDocument()
  })

  it('repairs and persists a same-day assignment with removed catalog ids', async () => {
    const stale = { dayKey: localDayKey(new Date()), level: 'A2' as const, itemIds: ['removed-catalog-id'], enrolledIds: [] }
    useForgeStore.setState({ dailyVocabularyAssignment: stale })

    render(<MemoryRouter><VocabularyLibraryPage /></MemoryRouter>)

    await waitFor(() => {
      const repaired = useForgeStore.getState().dailyVocabularyAssignment
      expect(repaired?.itemIds).toHaveLength(10)
      expect(repaired?.itemIds).not.toContain('removed-catalog-id')
    })
    await waitFor(() => {
      const container = JSON.parse(window.localStorage.getItem('english-forge-profile-v1')!) as { activeId: string; profiles: Record<string, { envelope: { state: { dailyVocabularyAssignment: { itemIds: string[] } } } }> }
      const persisted = container.profiles[container.activeId].envelope
      expect(persisted.state.dailyVocabularyAssignment.itemIds).toHaveLength(10)
      expect(persisted.state.dailyVocabularyAssignment.itemIds).not.toContain('removed-catalog-id')
    })
  })

  it('marks practice links on answer-visible cards as supported handoffs', async () => {
    const user = userEvent.setup()
    useForgeStore.setState((state) => ({ preferences: { ...state.preferences, currentLevel: 'B1' } }))
    render(<MemoryRouter><VocabularyLibraryPage /></MemoryRouter>)

    await waitFor(() => expect(useForgeStore.getState().dailyVocabularyAssignment?.level).toBe('B1'))
    const assignment = useForgeStore.getState().dailyVocabularyAssignment!
    const catalog = await loadLexicalCatalogLevel('B1')
    const item = catalog.find((entry) => entry.id === assignment.itemIds[0])!
    const group = await screen.findByRole('group', { name: `Значение выражения ${item.expression}` })
    await user.click(within(group).getByRole('button', { name: item.translationRu }))
    await user.click(await screen.findByRole('button', { name: /Добавить доступные на сегодня/i }))
    const links = await screen.findAllByRole('link', { name: /Тренировать/i })
    expect(links.length).toBeGreaterThan(0)
    expect(links.every((link) => link.getAttribute('href')?.includes('support=1'))).toBe(true)
  })

  it('archives and replaces a reference-only card marked as too simple', async () => {
    const user = userEvent.setup()
    const catalog = await loadLexicalCatalogLevel('A2')
    const reference = catalog.find((item) => item.activationReady !== true)!
    const assignment = {
      dayKey: localDayKey(new Date()), level: 'A2' as const,
      itemIds: [reference.id, ...catalog.filter((item) => item.id !== reference.id).slice(0, 9).map((item) => item.id)],
      enrolledIds: [],
    }
    useForgeStore.setState((state) => ({
      preferences: { ...state.preferences, currentLevel: 'A2' },
      dailyVocabularyAssignment: assignment,
      dailyVocabularyAssignments: [assignment],
    }))

    render(<MemoryRouter><VocabularyLibraryPage /></MemoryRouter>)
    const headings = await screen.findAllByRole('heading', { name: reference.expression })
    const dailyArticle = headings.map((heading) => heading.closest('article')).find((article) => article && within(article).queryByText('Знакомство'))!
    await user.click(within(dailyArticle).getByRole('button', { name: 'Слишком просто' }))

    await waitFor(() => expect(useForgeStore.getState().dailyVocabularyAssignment?.itemIds).not.toContain(reference.id))
    const archived = useForgeStore.getState().phrases.find((phrase) => phrase.tags.includes(catalogItemTag(reference.id)))
    expect(archived?.status).toBe('archived')
    expect(useForgeStore.getState().dailyVocabularyAssignment?.enrolledIds).not.toContain(reference.id)
  })
})
