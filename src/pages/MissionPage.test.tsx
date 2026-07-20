import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { createSeedData } from '../data/seed'
import { useForgeStore } from '../store/useForgeStore'
import { MissionPage } from './MissionPage'

describe('MissionPage adaptive contract', () => {
  beforeEach(() => {
    const data = createSeedData()
    const phrase = { ...data.phrases[0], cefr: 'A2' as const }
    useForgeStore.setState({
      ...data,
      phrases: data.phrases.map((item) => item.id === phrase.id ? phrase : item),
      preferences: { ...data.preferences, currentLevel: 'A2' },
      missions: [{
        ...data.missions[0],
        level: 'A2',
        targetPhraseIds: [phrase.id],
        targetResults: [{ phraseId: phrase.id, confirmed: false }],
        minWords: 40,
        maxWords: 70,
        targetPhraseCount: 1,
      }],
    })
  })

  afterEach(cleanup)

  it('keeps every canonical target form hidden before the response', () => {
    const phrase = useForgeStore.getState().phrases[0]
    useForgeStore.setState((state) => ({
      missions: state.missions.map((mission) => ({
        ...mission,
        title: `Use ${phrase.canonical} in a short brief`,
        prompt: `Retrieve ${phrase.canonical} and explain the result.`,
        grammarTarget: `Check the clause containing ${phrase.canonical}.`,
      })),
    }))

    render(<MemoryRouter><MissionPage /></MemoryRouter>)

    expect(document.body).not.toHaveTextContent(phrase.canonical)
    expect(screen.getByText(/вспомните по смыслу/i)).toBeInTheDocument()
    expect(screen.getByText(/целевые формы скрыты до завершения/i)).toBeInTheDocument()
  })

  it('shows and validates the range persisted with an A2-sized mission', () => {
    render(<MemoryRouter><MissionPage /></MemoryRouter>)

    expect(screen.getByText('40–70 слов')).toBeInTheDocument()
    expect(screen.getByText('Целевых выражений: 1')).toBeInTheDocument()
    expect(screen.getByText('Decision brief')).toHaveAttribute('lang', 'en')
    expect(screen.getByText(/A project delivered mixed results/)).toHaveAttribute('lang', 'en')
    expect(screen.getByText(/fail to reach the standard/)).toHaveAttribute('lang', 'en')
    expect(screen.getByText(/Use one hedged recommendation/)).toHaveAttribute('lang', 'en')
    expect(screen.getByLabelText('Ваш ответ')).toHaveAttribute('aria-describedby', 'mission-writing-hint')
    expect(screen.getByLabelText('Ваш ответ')).not.toHaveAttribute('placeholder')
    fireEvent.change(screen.getByLabelText('Ваш ответ'), { target: { value: 'A response that is too short.' } })
    fireEvent.click(screen.getByRole('button', { name: /завершить задание/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('от 40 до 70 слов')
  })

  it('marks a Russian retrieval cue with its actual language', () => {
    useForgeStore.setState((state) => ({
      phrases: state.phrases.map((phrase, index) => index === 0
        ? { ...phrase, meaning: 'не оправдать ожиданий' }
        : phrase),
    }))

    render(<MemoryRouter><MissionPage /></MemoryRouter>)

    expect(screen.getByText('не оправдать ожиданий')).toHaveAttribute('lang', 'ru')
  })

  it('explains the evidence needed when a higher-level mission cannot be created', () => {
    useForgeStore.setState((state) => ({ missions: [], phrases: [], skillStates: [], reviews: [], preferences: { ...state.preferences, currentLevel: 'B1' } }))
    render(<MemoryRouter><MissionPage /></MemoryRouter>)

    expect(screen.getByText(/минимум с 2 выражениями уровня B1/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /создать задание/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('Сначала изучите нужное количество')
  })

  it('deletes an unwanted mission only after explicit confirmation', () => {
    const missionId = useForgeStore.getState().missions[0].id
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<MemoryRouter><MissionPage /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: /^Удалить$/i }))

    expect(confirm).toHaveBeenCalledOnce()
    expect(useForgeStore.getState().missions.some((mission) => mission.id === missionId)).toBe(false)
    confirm.mockRestore()
  })
})
