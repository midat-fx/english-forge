import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEmptyData, createSeedData } from '../data/seed'
import type { LexicalCatalogItem } from '../domain/lexicalCatalog'
import { initialSkillState } from '../domain/scheduler'
import { useForgeStore } from '../store/useForgeStore'
import { PhraseBankPage } from './PhraseBankPage'

describe('PhraseBankPage evidence-derived lifecycle', () => {
  beforeEach(() => {
    const data = createEmptyData()
    const phrase = {
      ...createSeedData().phrases[0],
      status: 'active' as const,
      activationStage: 0,
      activationUpdatedAt: undefined,
    }
    data.phrases = [phrase]
    data.skillStates = [{ ...initialSkillState(phrase.id, 'meaning_recall'), mastery: 1, attempts: 99 }]
    useForgeStore.setState(data)
  })
  afterEach(cleanup)

  it('ignores a mutable active status and scheduler mastery when filtering and displaying evidence', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><PhraseBankPage /></MemoryRouter>)

    expect(screen.getAllByText('fall short of expectations').every((node) => node.getAttribute('lang') === 'en')).toBe(true)
    expect(screen.getAllByText('новое').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/0\/3/).length).toBeGreaterThan(0)
    expect(screen.queryByText('100%')).not.toBeInTheDocument()

    const statusFilter = screen.getByLabelText('Фильтр по статусу')
    await user.selectOptions(statusFilter, 'active')
    expect(screen.queryByText('fall short of expectations')).not.toBeInTheDocument()
    expect(screen.getByText('Ничего не найдено.')).toBeInTheDocument()

    await user.selectOptions(statusFilter, 'new')
    expect(screen.getAllByText('fall short of expectations').length).toBeGreaterThan(0)
  })

  it('marks a handoff from visible phrase details as supported practice', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><PhraseBankPage /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: 'Тренировать в практике' }))

    expect(window.location.hash).toContain('support=1')
  })

  it('hides matcher-only aliases from learners and preserves them through editing', async () => {
    const phrase = useForgeStore.getState().phrases[0]
    useForgeStore.setState({
      phrases: [{ ...phrase, activationError: undefined, acceptedForms: ['made a decision', 'make ...person ...-base', '...pluralcue decisions'] }],
    })
    const user = userEvent.setup()
    render(<MemoryRouter><PhraseBankPage /></MemoryRouter>)

    expect(screen.getByText(/made a decision/)).toBeInTheDocument()
    expect(screen.queryByText(/\.\.\.person|\.\.\.pluralcue/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Изменить' }))
    const forms = screen.getByLabelText('Допустимые формы')
    expect(forms).toHaveValue('made a decision')
    await user.clear(forms)
    await user.type(forms, 'reached a decision')
    expect(forms).toHaveValue('reached a decision')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))

    expect(useForgeStore.getState().phrases[0].acceptedForms).toEqual([
      'make ...person ...-base', '...pluralcue decisions', 'reached a decision',
    ])
  })

  it('shows personal Step-6 enrichment and clears it after a valid authored pair', async () => {
    const user = userEvent.setup()
    useForgeStore.setState(createEmptyData())
    const reference: LexicalCatalogItem = {
      id: 'lex-b1-personal-reference', level: 'B1', expression: 'keep steady progress', kind: 'collocation',
      translationRu: 'поддерживать устойчивый прогресс', meaningEn: 'continue improving at a consistent rate',
      example: 'Short daily sessions help us keep steady progress.', exampleTranslationRu: 'Короткие ежедневные занятия помогают поддерживать устойчивый прогресс.',
      topic: 'learning', register: 'neutral', pattern: 'keep + adjective + progress', activationReady: false,
    }
    const saved = useForgeStore.getState().saveReferenceCatalogItem(reference)

    render(<MemoryRouter initialEntries={[`/?selected=${saved.id}`]}><PhraseBankPage /></MemoryRouter>)

    expect(screen.getAllByText('нужен шаг 6').length).toBeGreaterThan(0)
    expect(screen.getByText('Первые пять шагов доступны')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Тренировать в практике' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Добавить паттерн шага 6' }))
    await user.type(screen.getByLabelText('Предложение с одной ошибкой'), 'Short daily sessions help us make steady progress.')
    await user.type(screen.getByLabelText('Исправленное предложение'), reference.example)
    await user.type(screen.getByLabelText('Короткая подсказка'), 'Use keep, not make, in this personal expression.')
    await user.click(screen.getByRole('button', { name: 'Сохранить' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Добавить паттерн шага 6' })).not.toBeInTheDocument())
    expect(useForgeStore.getState().phrases.find((phrase) => phrase.id === saved.id)?.activationError).toEqual({
      incorrectContext: 'Short daily sessions help us make steady progress.',
      expectedCorrection: reference.example,
      cue: 'Use keep, not make, in this personal expression.',
    })
  })
})
