import { useLayoutEffect } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { createEmptyData } from '../data/seed'
import { useForgeStore } from '../store/useForgeStore'
import { GrammarAcademyPage } from './GrammarAcademyPage'

function RouteLayoutProbe({ onLayout }: { onLayout: (search: string, lessonHeading: string | null) => void }) {
  const location = useLocation()
  useLayoutEffect(() => {
    onLayout(location.search, document.querySelector<HTMLElement>('article h2[lang="en"]')?.textContent ?? null)
  }, [location.search, onLayout])
  return null
}

function GrammarHandoffHarness({ onRouteLayout }: { onRouteLayout?: (search: string, lessonHeading: string | null) => void }) {
  const navigate = useNavigate()
  return <>
    <button type="button" onClick={() => navigate('/grammar?lesson=b1-past-perfect')}>Открыть следующий урок</button>
    <button type="button" onClick={() => navigate('/grammar?lesson=a2-present-continuous')}>Открыть урок того же уровня</button>
    <button type="button" onClick={() => navigate('/grammar?lesson=a2-present-simple&panel=practice')}>Изменить представление текущего урока</button>
    <GrammarAcademyPage />
    {onRouteLayout && <RouteLayoutProbe onLayout={onRouteLayout} />}
  </>
}

describe('GrammarAcademyPage route handoffs', () => {
  beforeEach(() => {
    useForgeStore.setState(createEmptyData())
  })

  afterEach(cleanup)

  it('atomically loads a changed lesson query and clears work from the previous lesson', async () => {
    const user = userEvent.setup()
    const destinationDraft = 'I had already saved this destination sentence before the lesson opened.'
    const destinationTransfer = 'She had already completed another example before the later deadline arrived.'
    useForgeStore.setState({
      grammarProgress: [{
        lessonId: 'b1-past-perfect', attempts: 2, passes: 1, bestScore: 3, totalQuestions: 3,
        lastAttemptedAt: '2026-07-01T08:00:00.000Z',
        productionDraft: destinationDraft,
        productionSavedAt: '2026-07-01T08:00:00.000Z',
        productionSelfConfirmedAt: '2026-07-01T08:00:00.000Z',
        transferDraft: destinationTransfer,
        transferSavedAt: '2026-07-02T08:00:00.000Z',
        transferSelfConfirmedAt: '2026-07-02T08:00:00.000Z',
      }],
    })
    const layoutSnapshots: Array<{ search: string; lessonHeading: string | null }> = []
    const recordRouteLayout = vi.fn((search: string, lessonHeading: string | null) => {
      layoutSnapshots.push({ search, lessonHeading })
    })
    render(
      <MemoryRouter initialEntries={['/grammar?lesson=a2-present-simple']}>
        <Routes>
          <Route path="grammar" element={<GrammarHandoffHarness onRouteLayout={recordRouteLayout} />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Present simple: routines and facts' })).toBeInTheDocument()
    const correction = screen.getByLabelText('Напишите весь исправленный вариант')
    await user.type(correction, 'Stale correction from the first lesson.')
    await user.click(screen.getByRole('button', { name: 'Проверить' }))
    expect(screen.getByText('Сравните с целевым вариантом:')).toBeInTheDocument()

    const production = screen.getByLabelText('Ваш новый пример')
    await user.type(production, 'This stale production draft belongs to the first lesson only.')
    const productionConfirmation = screen.getByRole('checkbox', { name: /Я сверил\(а\) форму/ })
    await user.click(productionConfirmation)
    await user.click(screen.getByTestId('grammar-answer-0-0'))
    await user.type(screen.getByPlaceholderText('Найти тему…'), 'Present simple')

    await user.click(screen.getByRole('button', { name: 'Открыть следующий урок' }))

    expect(await screen.findByRole('heading', { name: 'Past perfect: the earlier past' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^B1/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByPlaceholderText('Найти тему…')).toHaveValue('')
    expect(screen.getByLabelText('Напишите весь исправленный вариант')).toHaveValue('')
    expect(screen.getByLabelText('Напишите весь исправленный вариант')).toBeEnabled()
    expect(screen.queryByText('Сравните с целевым вариантом:')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Ваш новый пример')).toHaveValue(destinationDraft)
    expect(screen.getByRole('checkbox', { name: /Я сверил\(а\) форму/ })).toBeChecked()
    expect(screen.getByLabelText('Новое предложение для переноса')).toHaveValue(destinationTransfer)
    expect(screen.getByRole('checkbox', { name: /Я проверил\(а\), что контекст новый/ })).toBeChecked()
    expect(screen.getAllByTestId(/^grammar-answer-/u).every((answer) => answer.getAttribute('aria-pressed') === 'false')).toBe(true)
    expect(screen.getByTestId('grammar-check')).toBeDisabled()
    expect(layoutSnapshots.at(-1)).toEqual({
      search: '?lesson=b1-past-perfect',
      lessonHeading: 'Past perfect: the earlier past',
    })
  })

  it('preserves in-progress work when navigation keeps the same lesson identity', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/grammar?lesson=a2-present-simple']}>
        <Routes>
          <Route path="grammar" element={<GrammarHandoffHarness />} />
        </Routes>
      </MemoryRouter>,
    )

    const production = screen.getByLabelText('Ваш новый пример')
    await user.type(production, 'This unsaved sentence must survive an unrelated query change.')
    await user.click(screen.getByRole('checkbox', { name: /Я сверил\(а\) форму/ }))
    await user.click(screen.getByTestId('grammar-answer-0-0'))

    await user.click(screen.getByRole('button', { name: 'Изменить представление текущего урока' }))

    expect(screen.getByLabelText('Ваш новый пример')).toHaveValue('This unsaved sentence must survive an unrelated query change.')
    expect(screen.getByRole('checkbox', { name: /Я сверил\(а\) форму/ })).toBeChecked()
    expect(screen.getByTestId('grammar-answer-0-0')).toHaveAttribute('aria-pressed', 'true')
  })

  it('resets a cumulative checkpoint for a same-level lesson route handoff', async () => {
    const user = userEvent.setup()
    useForgeStore.setState({
      grammarProgress: [{
        lessonId: 'a2-present-simple', attempts: 1, passes: 0, bestScore: 1, totalQuestions: 3,
        lastAttemptedAt: '2026-07-01T08:00:00.000Z',
      }],
    })
    render(
      <MemoryRouter initialEntries={['/grammar?lesson=a2-present-simple']}>
        <Routes>
          <Route path="grammar" element={<GrammarHandoffHarness />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Начать · 1' }))
    expect(screen.queryByRole('button', { name: 'Начать · 1' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Открыть урок того же уровня' }))

    expect(await screen.findByRole('heading', { name: 'Present continuous: now and temporary situations' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Начать · 1' })).toBeInTheDocument()
  })

  it('hides lesson materials while a due blind transfer is being written', () => {
    useForgeStore.setState((state) => ({
      grammarProgress: [{
        lessonId: 'a2-present-simple', attempts: 1, passes: 1, bestScore: 3, totalQuestions: 3,
        lastAttemptedAt: '2026-07-16T08:00:00.000Z', lastPassedAt: '2026-07-16T08:00:00.000Z',
        productionDraft: 'My neighbour walks to work every weekday morning.',
        productionSavedAt: '2026-07-16T08:00:00.000Z',
        productionSelfConfirmedAt: '2026-07-16T08:00:00.000Z',
      }],
      preferences: { ...state.preferences, currentLevel: 'A2' },
    }))

    render(
      <MemoryRouter initialEntries={['/grammar?lesson=a2-present-simple']}>
        <Routes><Route path="grammar" element={<GrammarAcademyPage />} /></Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Вспомните конструкцию без подсказок.' })).toBeInTheDocument()
    expect(screen.getByText('Коммуникативная цель')).toBeInTheDocument()
    expect(screen.getByText('Контроль той же конструкции · 3/3')).toBeInTheDocument()
    expect(screen.getAllByText(/^[123]$/u)).toHaveLength(3)
    expect(screen.getByLabelText('Новое предложение для переноса')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Примеры' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Напишите весь исправленный вариант')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Ваш новый пример')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Категория грамматики')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Grammar lessons' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Переход между уроками' })).not.toBeInTheDocument()
    expect(screen.queryByText('Накопительная проверка')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Present simple: routines and facts' })).not.toBeInTheDocument()
  })
})
