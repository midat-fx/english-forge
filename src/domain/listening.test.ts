import { describe, expect, it } from 'vitest'
import { createSeedData } from '../data/seed'
import { deriveListeningResults, dictationMatches, listeningAttemptHasVerifiedEvidence, selectDailyListeningReference } from './listening'

describe('daily listening selection', () => {
  it('reuses a sufficiently activated same-level expression and falls back safely', () => {
    const data = createSeedData()
    const phrase = { ...data.phrases[0], cefr: 'B1' as const, status: 'learning' as const, activationStage: 6 }
    const fallback = [{ id: 'fallback', text: 'This is a carefully authored fallback listening sentence.' }]
    expect(selectDailyListeningReference([phrase], 'B1', '2026-07-18', fallback)).toMatchObject({ phraseId: phrase.id, text: phrase.context })
    expect(selectDailyListeningReference([{ ...phrase, activationStage: 5 }], 'B1', '2026-07-18', fallback)).toEqual(fallback[0])
  })

  it('uses one word-aligned 85% matcher in the UI and imported evidence boundary', () => {
    expect(dictationMatches('one two three four five six seven eight nine ten', 'one two three four five six seven eight nine ten')).toBe(true)
    expect(dictationMatches('one two three four five six seven eight nine wrong', 'one two three four five six seven eight nine ten')).toBe(true)
    expect(dictationMatches('one two three four five six seven eight wrong wrong', 'one two three four five six seven eight nine ten')).toBe(false)
    expect(dictationMatches('one two three', 'one two three four')).toBe(false)
    expect(dictationMatches('one two extra three four five six seven eight nine ten', 'one two three four five six seven eight nine ten')).toBe(true)
    expect(dictationMatches('one two four five six seven eight nine ten', 'one two three four five six seven eight nine ten')).toBe(true)
    expect(dictationMatches('one two extra extra three four five six seven eight nine ten', 'one two three four five six seven eight nine ten')).toBe(false)
  })

  it('recomputes the combined result from immutable dictation and comprehension snapshots', () => {
    const attempt = {
      id: 'attempt', sourceId: 'daily', mode: 'dictation' as const, response: 'The train leaves now.', answerMatched: true,
      revealUsed: false, playbackCompleted: true, referenceTranscript: 'The train leaves now.',
      comprehensionQuestion: 'When?', comprehensionResponse: 'Now', comprehensionExpectedResponse: 'Now', comprehensionMatched: true,
      listeningEvidenceVersion: 1 as const, durationSeconds: 2, createdAt: '2026-07-18T08:00:00.000Z',
    }
    expect(deriveListeningResults(attempt)).toMatchObject({ dictationMatched: true, comprehensionMatched: true, answerMatched: true })
    expect(listeningAttemptHasVerifiedEvidence(attempt)).toBe(true)
    expect(listeningAttemptHasVerifiedEvidence({ ...attempt, comprehensionResponse: 'Later' })).toBe(false)
  })
})
