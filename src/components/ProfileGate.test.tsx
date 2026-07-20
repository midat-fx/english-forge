import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { beginProfileHydration, markProfileReady } from '../data/profileStorage'
import { ProfileGate } from './ProfileGate'

describe('profile hydration gate', () => {
  it('does not expose mutation controls before hydration finishes', () => {
    beginProfileHydration()
    render(<ProfileGate><button type="button">Mutate profile</button></ProfileGate>)
    expect(screen.getByText('Открываем локальный профиль…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mutate profile' })).not.toBeInTheDocument()
    act(() => markProfileReady())
    expect(screen.getByRole('button', { name: 'Mutate profile' })).toBeInTheDocument()
  })
})
