import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { createSeedData } from '../data/seed'
import { activationRecognitionLabel } from '../domain/practice'
import { initialSkillState } from '../domain/scheduler'
import { useForgeStore } from '../store/useForgeStore'
import { activationEventsThrough as qualifiedEventsThrough } from '../test/activationEvidence'
import { PracticePage } from './PracticePage'

describe('PracticePage cross-route support provenance', () => {
  beforeEach(() => {
    const data = createSeedData()
    data.phrases = data.phrases.map((phrase) => phrase.id === 'phrase-fall-short'
      ? { ...phrase, activationStage: 0, activationEvents: [], activationUpdatedAt: undefined }
      : phrase)
    useForgeStore.setState(data)
  })

  afterEach(cleanup)

  it('caps visible-card practice at Hard and does not advance activation', async () => {
    const user = userEvent.setup()
    const target = useForgeStore.getState().phrases.find((phrase) => phrase.id === 'phrase-fall-short')!
    render(<MemoryRouter initialEntries={[`/practice?phrase=${target.id}&support=1`]}><PracticePage /></MemoryRouter>)

    expect(screen.getByText(/целевая формулировка была видна/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: activationRecognitionLabel(target) }))
    await user.click(screen.getByRole('button', { name: /^Проверить/ }))

    expect(screen.getByRole('button', { name: /Хорошо/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Легко/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Трудно/ })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: /Трудно/ }))

    expect(screen.getByRole('heading', { name: 'Тренировочная попытка завершена.' })).toBeInTheDocument()
    expect(useForgeStore.getState().phrases.find((phrase) => phrase.id === target.id)?.activationStage).toBe(0)
  })

  it('treats the authored Step-6 cue as counted help instead of exposing it in the task', async () => {
    const user = userEvent.setup()
    const target = useForgeStore.getState().phrases.find((phrase) => phrase.id === 'phrase-fall-short')!
    const activationEvents = ([1, 2, 3, 4, 5] as const).map((stage, index) => ({
      stage,
      completedAt: new Date(Date.UTC(2026, 6, 14, index * 12)).toISOString(),
    }))
    useForgeStore.setState((state) => ({
      phrases: state.phrases.map((phrase) => phrase.id === target.id ? { ...phrase, activationStage: 5 as const, activationEvents } : phrase),
    }))
    render(<MemoryRouter initialEntries={[`/practice?phrase=${target.id}`]}><PracticePage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Найдите и исправьте ошибку в предложении.' })).toBeInTheDocument()
    expect(screen.queryByText(target.activationError!.cue)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Подсказка' }))
    expect(screen.getByText(target.activationError!.cue)).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('Перепишите всё предложение с исправлением…'), target.activationError!.expectedCorrection)
    await user.click(screen.getByRole('button', { name: /^Проверить/ }))
    expect(screen.getByRole('button', { name: /Хорошо/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Трудно/ })).toBeEnabled()
  })

  it('keeps one activation lane and two due SRS lanes inside a five-minute session', async () => {
    const user = userEvent.setup()
    const data = createSeedData()
    const [activationBase, ...reviewBases] = data.phrases.filter((phrase) => phrase.cefr === 'B2')
    const activationPhrase = {
      ...activationBase,
      id: 'five-minute-activation',
      activationStage: 5 as const,
      activationEvents: qualifiedEventsThrough(activationBase, 5),
      practiceExposures: [],
    }
    const reviewPhrases = reviewBases.slice(0, 3).map((base, index) => ({
      ...base,
      id: `five-minute-review-${index}`,
      activationStage: 7 as const,
      activationEvents: qualifiedEventsThrough(base, 6),
      practiceExposures: [],
    }))
    const now = new Date()
    useForgeStore.setState({
      ...data,
      phrases: [activationPhrase, ...reviewPhrases],
      skillStates: reviewPhrases.map((phrase) => initialSkillState(phrase.id, 'meaning_recall', now)),
      reviews: [],
      preferences: { ...data.preferences, dailyMinutes: 5, currentLevel: 'B2' },
      dailyVocabularyAssignment: null,
      dailyVocabularyAssignments: [],
    })

    render(<MemoryRouter initialEntries={['/practice']}><PracticePage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: '5 мин' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Заданий: 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '10 мин' }))
    expect(screen.getByText('Заданий: 4')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '5 мин' }))
    expect(screen.getByText('Заданий: 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Начать занятие/ }))

    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Прогресс занятия' })).toHaveAttribute('aria-valuemin', '1')
    expect(screen.getByRole('progressbar', { name: 'Прогресс занятия' })).toHaveAttribute('aria-valuemax', '3')
    expect(screen.getByRole('progressbar', { name: 'Прогресс занятия' })).toHaveAttribute('aria-valuenow', '1')
    expect(screen.getByText('Коррекция')).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('Перепишите всё предложение с исправлением…'), activationPhrase.activationError!.expectedCorrection)
    await user.click(screen.getByRole('button', { name: /^Проверить/ }))
    await user.click(screen.getByRole('button', { name: /Хорошо/ }))

    expect(screen.getByText('2 / 3')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Прогресс занятия' })).toHaveAttribute('aria-valuenow', '2')
    expect(screen.getByText('Вспоминание')).toBeInTheDocument()
  })

  it('persists feedback exposure before grading and suppresses a remount escape', async () => {
    const user = userEvent.setup()
    const data = createSeedData()
    const base = data.phrases.find((phrase) => phrase.cefr === 'B2')!
    const phrase = {
      ...base,
      id: 'feedback-remount-guard',
      activationStage: 7 as const,
      activationEvents: qualifiedEventsThrough(base, 6),
      practiceExposures: [],
    }
    const now = new Date()
    useForgeStore.setState({
      ...data,
      phrases: [phrase],
      skillStates: [
        initialSkillState(phrase.id, 'meaning_recall', now),
        initialSkillState(phrase.id, 'cloze', now),
      ],
      reviews: [],
      preferences: { ...data.preferences, dailyMinutes: 5, currentLevel: 'B2' },
      dailyVocabularyAssignment: null,
      dailyVocabularyAssignments: [],
    })

    const view = render(<MemoryRouter initialEntries={['/practice']}><PracticePage /></MemoryRouter>)
    expect(screen.getByText('Заданий: 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Начать занятие/ }))
    await user.type(screen.getByPlaceholderText('Введите выражение полностью…'), phrase.canonical)
    await user.click(screen.getByRole('button', { name: /^Проверить/ }))

    expect(useForgeStore.getState().phrases[0].practiceExposures).toHaveLength(1)
    expect(useForgeStore.getState().reviews).toEqual([])
    view.unmount()
    render(<MemoryRouter initialEntries={['/practice']}><PracticePage /></MemoryRouter>)
    expect(screen.getByText('Заданий: 0')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Начать занятие/ })).toBeDisabled()
  })
})
