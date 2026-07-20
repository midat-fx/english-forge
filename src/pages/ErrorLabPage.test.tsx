import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeedData } from '../data/seed'
import { useForgeStore } from '../store/useForgeStore'
import { ErrorLabPage } from './ErrorLabPage'

describe('ErrorLabPage localization and due gate', () => {
  beforeEach(() => {
    useForgeStore.setState(createSeedData())
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('uses Russian controls and marks English learner sentences and inputs', async () => {
    const user = userEvent.setup()
    render(<ErrorLabPage />)

    expect(screen.getByText('Нужно внимание')).toBeInTheDocument()
    expect(screen.getByText('Свидетельства из вашей практики')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Изменить принятый вариант' })).toBeInTheDocument()
    expect(screen.getAllByText('It depends from the context.').every((node) => node.getAttribute('lang') === 'en')).toBe(true)

    const response = screen.getByLabelText('Ваш исправленный вариант')
    expect(response).toHaveAttribute('lang', 'en')
    expect(response).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Изменить принятый вариант' }))
    expect(screen.getByLabelText('Принятый вариант')).toHaveAttribute('lang', 'en')

    await user.click(screen.getByRole('button', { name: /Открыть паттерн: Verb form after/ }))
    expect(screen.getByLabelText('Ваш исправленный вариант')).toBeDisabled()
    expect(screen.getByText(/Перенос откроется завтра/)).toBeInTheDocument()
  })

  it('localizes validation returned by the store and marks sentence fields as English', async () => {
    const user = userEvent.setup()
    render(<ErrorLabPage />)

    await user.click(screen.getByRole('button', { name: 'Добавить личный паттерн' }))

    const original = screen.getByLabelText('Исходное предложение')
    const correction = screen.getByLabelText('Принятый исправленный вариант')
    const transferPrompt = screen.getByLabelText('Задание в новом контексте')
    const transferAnswer = screen.getByLabelText('Принятый ответ для переноса')
    for (const field of [original, correction, transferPrompt, transferAnswer]) expect(field).toHaveAttribute('lang', 'en')

    await user.click(screen.getByRole('button', { name: 'Сохранить паттерн' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Добавьте исходное и исправленное предложения.')

    await user.type(original, 'I depend from this result.')
    await user.type(correction, 'I depend on this result.')
    await user.click(screen.getByRole('button', { name: 'Сохранить паттерн' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Добавьте отдельное задание для нового контекста и принятый ответ.')
  })

  it('opens a due-now pattern added after mount even when the page clock was idle', () => {
    vi.useFakeTimers()
    const mountedAt = new Date('2026-07-18T08:00:00.000Z')
    vi.setSystemTime(mountedAt)
    useForgeStore.setState({ errors: [] })
    const intervalSpy = vi.spyOn(window, 'setInterval')
    render(<ErrorLabPage />)

    expect(screen.queryByLabelText('Ваш исправленный вариант')).not.toBeInTheDocument()
    vi.setSystemTime(new Date(mountedAt.getTime() + 5 * 60_000))
    act(() => {
      const result = useForgeStore.getState().addError({
        label: 'New due pattern',
        category: 'prepositions',
        original: 'I rely from this source.',
        correction: 'I rely on this source.',
        hint: 'Check the governed preposition.',
        rule: 'Use rely on.',
        transferPrompt: 'She relies from reliable evidence.',
        transferAnswer: 'She relies on reliable evidence.',
      })
      expect(result.id).toBeTruthy()
    })

    expect(screen.getByLabelText('Ваш исправленный вариант')).toBeEnabled()
    expect(screen.getByText('Принятый ответ остаётся скрытым, пока вы печатаете.')).toBeInTheDocument()
    expect(intervalSpy).not.toHaveBeenCalled()
  })

  it('records a due repair and reports the result in Russian', async () => {
    const user = userEvent.setup()
    render(<ErrorLabPage />)

    await user.type(screen.getByLabelText('Ваш исправленный вариант'), 'It depends on the context.')
    await user.click(screen.getByRole('button', { name: 'Проверить' }))

    expect(screen.getByRole('status')).toHaveTextContent('Исправление принято.')
    expect(useForgeStore.getState().errors.find((error) => error.id === 'error-depend-on')?.attempts).toHaveLength(1)
  })

  it('keeps the rule hidden until feedback turns the attempt into supported practice', async () => {
    const user = userEvent.setup()
    const rule = useForgeStore.getState().errors.find((error) => error.id === 'error-depend-on')!.rule
    render(<ErrorLabPage />)

    expect(screen.queryByText(rule)).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Ваш исправленный вариант'), 'This answer is still wrong.')
    await user.click(screen.getByRole('button', { name: 'Проверить' }))
    expect(screen.getByText(rule)).toBeInTheDocument()
  })

  it('persists the retry delay after a miss and rejects immediate store bypasses', async () => {
    const user = userEvent.setup()
    const view = render(<ErrorLabPage />)
    const response = screen.getByLabelText('Ваш исправленный вариант')

    await user.type(response, 'This is still wrong.')
    await user.click(screen.getByRole('button', { name: 'Проверить' }))
    expect(response).toBeDisabled()
    expect(screen.getByText(/интервал — часть проверки/)).toBeInTheDocument()

    useForgeStore.getState().recordErrorAttempt('error-depend-on', 'It depends on the context.', true, false, false)
    expect(useForgeStore.getState().errors.find((error) => error.id === 'error-depend-on')?.attempts).toHaveLength(1)

    view.unmount()
    render(<ErrorLabPage />)
    expect(screen.getByLabelText('Ваш исправленный вариант')).toBeDisabled()
  })

  it('uses minute precision until the final minute, then counts seconds and unlocks exactly when due', async () => {
    vi.useFakeTimers()
    const startedAt = new Date('2026-07-18T08:00:00.000Z')
    vi.setSystemTime(startedAt)
    const dueAt = new Date(startedAt.getTime() + 10 * 60_000).toISOString()
    useForgeStore.setState((state) => ({
      errors: state.errors.map((error) => error.id === 'error-depend-on' ? { ...error, dueAt } : error),
    }))

    const intervalSpy = vi.spyOn(window, 'setInterval')
    const timeoutSpy = vi.spyOn(window, 'setTimeout')
    render(<ErrorLabPage />)

    const response = screen.getByLabelText('Ваш исправленный вариант')
    expect(response).toBeDisabled()
    expect(screen.getAllByText(/через 10 мин/)).not.toHaveLength(0)
    expect(screen.queryByText(/через 1 час/)).not.toBeInTheDocument()
    expect(intervalSpy).not.toHaveBeenCalled()
    expect(timeoutSpy.mock.calls.some(([, delay]) => delay === 60_000)).toBe(true)
    expect(timeoutSpy.mock.calls.some(([, delay]) => delay === 1_000)).toBe(false)

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })
    expect(screen.getAllByText(/через 10 мин/)).not.toHaveLength(0)

    await act(async () => { await vi.advanceTimersByTimeAsync(8 * 60_000 + 59_000) })
    expect(response).toBeDisabled()
    expect(screen.getAllByText(/через 1 мин/)).not.toHaveLength(0)

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })
    expect(screen.getAllByText(/через 59 с/)).not.toHaveLength(0)

    await act(async () => { await vi.advanceTimersByTimeAsync(59_000) })
    expect(response).toBeEnabled()
    expect(screen.getByText('Принятый ответ остаётся скрытым, пока вы печатаете.')).toBeInTheDocument()
  })

  it('clears feedback support when an open failed workbench reaches its retry time', async () => {
    vi.useFakeTimers()
    const startedAt = new Date('2026-07-18T08:00:00.000Z')
    vi.setSystemTime(startedAt)
    useForgeStore.setState((state) => ({
      errors: state.errors.map((error) => error.id === 'error-depend-on' ? { ...error, dueAt: startedAt.toISOString() } : error),
    }))
    const rule = useForgeStore.getState().errors.find((error) => error.id === 'error-depend-on')!.rule
    render(<ErrorLabPage />)

    const response = screen.getByLabelText('Ваш исправленный вариант')
    fireEvent.change(response, { target: { value: 'This answer is still wrong.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Проверить' }))
    expect(response).toBeDisabled()
    expect(screen.getByText(rule)).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()

    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000) })
    expect(response).toBeEnabled()
    expect(response).toHaveValue('')
    expect(screen.queryByText(rule)).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText('Принятый ответ остаётся скрытым, пока вы печатаете.')).toBeInTheDocument()
  })
})
