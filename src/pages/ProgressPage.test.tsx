import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSeedData } from '../data/seed'
import { useForgeStore } from '../store/useForgeStore'
import { ProgressPage } from './ProgressPage'

describe('ProgressPage localization', () => {
  beforeEach(() => {
    useForgeStore.setState(createSeedData())
  })
  afterEach(cleanup)

  it('presents progress controls and evidence labels in Russian', async () => {
    const user = userEvent.setup()
    render(<ProgressPage />)

    expect(screen.getByText('Активность повторений')).toBeInTheDocument()
    expect(screen.getByText('Сохранено → закреплено')).toBeInTheDocument()
    expect(screen.queryByText('Review activity')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Показать таблицу' }))

    expect(screen.getByRole('columnheader', { name: 'Неделя' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Повторения' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Показать график' })).toBeInTheDocument()
  })

  it('marks English learning evidence with the correct language of parts', () => {
    render(<ProgressPage />)

    expect(screen.getAllByText('bear in mind').every((node) => node.getAttribute('lang') === 'en')).toBe(true)
  })
})
