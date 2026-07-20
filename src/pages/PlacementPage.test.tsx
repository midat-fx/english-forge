import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PLACEMENT_LISTENING_PROMPTS } from '../data/listeningPromptBank'
import { PLACEMENT_QUESTIONS } from '../data/placementTest'
import { useForgeStore } from '../store/useForgeStore'
import { PlacementPage } from './PlacementPage'

describe('saved placement profile', () => {
  beforeEach(async () => { await useForgeStore.getState().resetToDemo() })
  afterEach(cleanup)

  it('reopens and recomputes the latest skill profile without creating another attempt', async () => {
    const selected = Object.fromEntries(PLACEMENT_QUESTIONS.map((question) => [question.id, question.correctIndex]))
    const missedGrammar = PLACEMENT_QUESTIONS.find((question) => question.id === 'c1-01')!
    selected[missedGrammar.id] = (missedGrammar.correctIndex + 1) % missedGrammar.choices.length
    const listeningDiagnostic = {
      evidenceVersion: 1 as const,
      promptSetVersion: 1 as const,
      answers: PLACEMENT_LISTENING_PROMPTS.map((prompt) => ({
        promptId: prompt.id,
        selectedIndex: prompt.answerIndex,
        dictation: prompt.text,
        playbackCompleted: true as const,
        replayCount: 0,
      })),
      completedAt: new Date(Date.now() - 1_000).toISOString(),
    }
    expect(await useForgeStore.getState().completePlacement(selected, listeningDiagnostic)).toBe(true)
    const savedAttemptId = useForgeStore.getState().placementAttempts[0].id
    const user = userEvent.setup()

    render(<PlacementPage />)
    await user.click(screen.getByRole('button', { name: 'Открыть последний профиль' }))

    expect(screen.getByText('Сохранённая диагностика')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'грамматика: 7 из 8' })).toHaveAttribute('aria-valuenow', '7')
    expect(screen.getByRole('progressbar', { name: 'лексика: 8 из 8' })).toHaveAttribute('aria-valuenow', '8')
    expect(screen.getByText(/Понимание смысла: 8\/8/)).toBeInTheDocument()
    expect(screen.getByText(/не меняют основной CEFR‑результат или учебный маршрут/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Пройти снова' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Сохранить и проверить/ })).not.toBeInTheDocument()
    expect(useForgeStore.getState().placementAttempts.map((attempt) => attempt.id)).toEqual([savedAttemptId])

    await user.click(screen.getByRole('button', { name: 'Закрыть профиль' }))
    expect(screen.getByRole('button', { name: 'Открыть последний профиль' })).toBeInTheDocument()
    expect(useForgeStore.getState().placementAttempts.map((attempt) => attempt.id)).toEqual([savedAttemptId])
  })
})
