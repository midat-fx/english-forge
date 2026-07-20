import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { createEmptyData, createSeedData } from '../data/seed'
import { useForgeStore } from '../store/useForgeStore'
import { VoiceLabPage } from './VoiceLabPage'

describe('VoiceLabPage accessibility and practice modes', () => {
  beforeEach(() => {
    useForgeStore.setState(createEmptyData())
  })

  afterEach(cleanup)

  it('supports arrow-key tab navigation with linked tab panels', () => {
    render(<MemoryRouter><VoiceLabPage /></MemoryRouter>)

    const speaking = screen.getByRole('tab', { name: /говорить/i })
    const listening = screen.getByRole('tab', { name: /слушать/i })
    expect(speaking).toHaveAttribute('aria-controls', 'voice-speaking-panel')
    expect(speaking).toHaveAttribute('aria-selected', 'true')

    speaking.focus()
    fireEvent.keyDown(speaking, { key: 'ArrowRight' })

    expect(listening).toHaveFocus()
    expect(listening).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'voice-listening-panel')
  })

  it('offers shadowing without presenting it as productive evidence', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><VoiceLabPage /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: /теневой повтор/i }))

    expect(screen.getByRole('button', { name: /теневой повтор/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/запишите теневой повтор/i)).toBeInTheDocument()
    expect(screen.getByText(/не доказательство активной речи/i)).toBeInTheDocument()
  })

  it('keeps service guidance Russian and marks fallback learning content as English', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><VoiceLabPage /></MemoryRouter>)

    const prompt = screen.getByLabelText('Тема для ответа')
    expect(prompt).toHaveAttribute('lang', 'en')
    await user.clear(prompt)
    await user.click(screen.getByRole('button', { name: 'Сохранить попытку' }))
    expect(screen.getByText('Добавьте тему перед сохранением.')).toHaveAttribute('role', 'status')

    await user.click(screen.getByRole('tab', { name: /слушать/i }))
    const response = screen.getByLabelText('Что вы услышали')
    expect(response).toHaveAttribute('lang', 'en')
    expect(response).not.toHaveAttribute('placeholder')
    const comprehension = screen.getByRole('group', { name: /Короткий вопрос по смыслу/i })
    const reveal = screen.getByRole('button', { name: /Открыть только после попытки/i })
    expect(reveal).toBeDisabled()
    expect(comprehension.querySelector('legend [lang="en"]')).not.toBeNull()
    expect(within(comprehension).getAllByRole('button').every((choice) => choice.getAttribute('lang') === 'en')).toBe(true)
    await user.type(response, 'A complete first dictation attempt.')
    await user.click(within(comprehension).getAllByRole('button')[0])
    expect(reveal).toBeEnabled()
  })

  it('hides selected canonical forms and keeps prompt exposure sticky after deletion', () => {
    const data = createSeedData()
    const phrase = data.phrases.find((item) => item.id === 'phrase-bear-in-mind')!
    data.speakingAttempts = [{
      id: 'past-attempt', idempotencyKey: 'past-attempt', sessionId: 'past-attempt', mode: 'targeted_response', prompt: 'Give advice.',
      targetPhraseIds: [phrase.id], detectedPhraseIds: [phrase.id], confirmedPhraseIds: [phrase.id],
      transcript: `Please ${phrase.canonical} that this estimate may change tomorrow.`, durationSeconds: 8,
      recordingId: 'past_audio', mimeType: 'audio/webm', supportUsed: false, selfRating: { clarity: 4, flow: 4 }, createdAt: '2026-07-18T08:00:00.000Z',
    }]
    useForgeStore.setState(data)

    render(<MemoryRouter initialEntries={[`/voice?phrase=${phrase.id}`]}><VoiceLabPage /></MemoryRouter>)

    expect(document.body).not.toHaveTextContent(phrase.canonical)
    expect(screen.getAllByText('remember and consider something when making a decision').every((cue) => cue.getAttribute('lang') === 'en')).toBe(true)
    fireEvent.change(screen.getByLabelText('Тема для ответа'), { target: { value: `Please ${phrase.canonical} while you answer.` } })
    const support = screen.getByRole('checkbox', { name: /попытка отмечена как выполненная с опорой/i })
    expect(support).toBeChecked()
    expect(support).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Тема для ответа'), { target: { value: 'Give a short project update without reading notes.' } })
    expect(support).toBeChecked()
    expect(support).toBeDisabled()
  })

  it('does not let an unrelated incomplete fluency family override a direct target route', () => {
    const data = createSeedData()
    const direct = data.phrases.find((item) => item.id === 'phrase-fall-short')!
    const other = data.phrases.find((item) => item.id === 'phrase-bear-in-mind')!
    data.preferences = { ...data.preferences, currentLevel: 'C1' }
    data.speakingAttempts = [{
      id: 'incomplete-family-1', idempotencyKey: 'incomplete-family-1', sessionId: 'incomplete-family', mode: 'fluency_432', round: 1,
      prompt: 'Give advice.', targetPhraseIds: [other.id], detectedPhraseIds: [], confirmedPhraseIds: [], evidenceEligiblePhraseIds: [],
      transcript: 'This is an unfinished fluency practice response.', durationSeconds: 8, recordingId: 'unfinished_audio', mimeType: 'audio/webm',
      targetFormVisible: false, supportUsed: false, selfRating: { clarity: 3, flow: 3 }, createdAt: '2026-07-18T08:00:00.000Z',
    }]
    useForgeStore.setState(data)

    render(<MemoryRouter initialEntries={[`/voice?phrase=${direct.id}`]}><VoiceLabPage /></MemoryRouter>)

    expect(screen.queryByText(/Продолжаем незавершённую лестницу/i)).not.toBeInTheDocument()
    const directTargetButton = screen.getAllByText(direct.meaning).map((node) => node.closest('button')).find(Boolean)
    expect(directTargetButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('preserves visible-card handoff provenance as forced support', () => {
    const data = createSeedData()
    const phrase = data.phrases.find((item) => item.id === 'phrase-bear-in-mind')!
    useForgeStore.setState(data)

    render(<MemoryRouter initialEntries={[`/voice?phrase=${phrase.id}&support=1`]}><VoiceLabPage /></MemoryRouter>)

    const support = screen.getByRole('checkbox', { name: /была видна перед переходом/i })
    expect(support).toBeChecked()
    expect(support).toBeDisabled()
    expect(document.body).not.toHaveTextContent(phrase.canonical)
  })

  it('keeps an oversized imported clip visible but quarantined from practice', async () => {
    const user = userEvent.setup()
    const data = createEmptyData()
    data.listeningClips = [{
      id: 'legacy-long-clip', title: 'Long archived interview', source: 'Archive', transcript: 'Preserved transcript',
      recordingId: 'legacy_long_audio', mimeType: 'audio/webm', durationSeconds: 300,
      quarantine: { reason: 'duration_limit', originalDurationSeconds: 421.75 },
      createdAt: '2026-07-10T08:00:00.000Z', updatedAt: '2026-07-10T08:00:00.000Z',
    }]
    useForgeStore.setState(data)
    render(<MemoryRouter><VoiceLabPage /></MemoryRouter>)

    await user.click(screen.getByRole('tab', { name: /слушать/i }))

    expect(screen.getByText('Long archived interview')).toBeInTheDocument()
    expect(screen.getByText('карантин импорта')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('исключён из практики')
    expect(screen.queryByRole('button', { name: 'Загрузить локальное аудио' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Ваш диктант или краткие заметки/i)).not.toBeInTheDocument()
  })
})
