import { createRef } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeedData } from '../data/seed'
import { SettingsPage } from '../pages/SettingsPage'
import { useForgeStore } from '../store/useForgeStore'
import { ErrorBoundary } from './ErrorBoundary'

describe('profile recovery file inputs', () => {
  beforeEach(() => {
    useForgeStore.setState(createSeedData())
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('labels the ErrorBoundary backup input and keeps the custom import button connected', () => {
    const boundary = createRef<ErrorBoundary>()
    render(<ErrorBoundary ref={boundary}><p>Рабочий экран</p></ErrorBoundary>)
    act(() => boundary.current?.setState({ failed: true, recoveryMessage: '' }))

    const input = screen.getByLabelText('Резервная копия профиля JSON')
    expect(input).toHaveAttribute('type', 'file')
    expect(input).toHaveAttribute('tabindex', '-1')
    const click = vi.spyOn(input as HTMLInputElement, 'click')

    fireEvent.click(screen.getByRole('button', { name: 'Импортировать копию' }))
    expect(click).toHaveBeenCalledOnce()
  })

  it('labels the Settings backup input and keeps the desktop fallback button connected', async () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    const input = screen.getByLabelText('Резервная копия профиля JSON')
    expect(input).toHaveAttribute('type', 'file')
    expect(input).toHaveAttribute('tabindex', '-1')
    const click = vi.spyOn(input as HTMLInputElement, 'click')

    fireEvent.click(screen.getByRole('button', { name: 'Импорт JSON English Forge' }))
    await waitFor(() => expect(click).toHaveBeenCalledOnce())
  })
})
