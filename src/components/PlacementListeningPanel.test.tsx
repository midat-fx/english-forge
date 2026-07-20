import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PlacementListeningPanel } from './PlacementListeningPanel'

afterEach(cleanup)

describe('PlacementListeningPanel', () => {
  it('fails gracefully when system speech is unavailable', () => {
    const original = globalThis.SpeechSynthesisUtterance
    // @ts-expect-error Exercise the unsupported-browser branch.
    delete globalThis.SpeechSynthesisUtterance
    render(<PlacementListeningPanel onComplete={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /начать listening/i }))
    expect(screen.getByRole('status')).toHaveTextContent(/недоступен системный синтез речи/i)
    globalThis.SpeechSynthesisUtterance = original
  })

  it('uses roving focus and arrow-key selection inside the answer radiogroup', () => {
    const originalUtterance = globalThis.SpeechSynthesisUtterance
    const originalSpeech = Object.getOwnPropertyDescriptor(window, 'speechSynthesis')
    class MockUtterance {
      text: string
      lang = ''
      rate = 1
      onend: (() => void) | null = null
      onerror: (() => void) | null = null
      constructor(text: string) { this.text = text }
    }
    globalThis.SpeechSynthesisUtterance = MockUtterance as unknown as typeof SpeechSynthesisUtterance
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel: vi.fn(),
        speak: vi.fn((utterance: MockUtterance) => utterance.onend?.()),
      },
    })

    try {
      render(<PlacementListeningPanel onComplete={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: /начать listening/i }))
      fireEvent.click(screen.getByRole('button', { name: /прослушать полностью/i }))
      const choices = screen.getAllByRole('radio')
      expect(choices[0]).toHaveAttribute('tabindex', '0')
      expect(choices[1]).toHaveAttribute('tabindex', '-1')

      choices[0].focus()
      fireEvent.keyDown(choices[0], { key: 'ArrowDown' })
      expect(choices[1]).toHaveFocus()
      expect(choices[1]).toHaveAttribute('aria-checked', 'true')
      expect(choices[1]).toHaveAttribute('tabindex', '0')

      fireEvent.keyDown(choices[1], { key: 'End' })
      expect(choices.at(-1)).toHaveFocus()
      expect(choices.at(-1)).toHaveAttribute('aria-checked', 'true')
    } finally {
      globalThis.SpeechSynthesisUtterance = originalUtterance
      if (originalSpeech) Object.defineProperty(window, 'speechSynthesis', originalSpeech)
      else delete (window as { speechSynthesis?: SpeechSynthesis }).speechSynthesis
    }
  })
})
