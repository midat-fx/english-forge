import { describe, expect, it } from 'vitest'
import type { Phrase, SpeakingAttempt } from './types'
import { isCompletedSpeakingPractice, speakingEvidencePhraseIds } from './speaking'
import { createSeedData } from '../data/seed'
import { activationEventsThrough as qualifiedEventsThrough } from '../test/activationEvidence'

const base: SpeakingAttempt = {
  id: 'attempt', idempotencyKey: 'attempt', sessionId: 'session', mode: 'targeted_response', prompt: 'Respond.',
  targetPhraseIds: ['phrase'], detectedPhraseIds: ['phrase'], confirmedPhraseIds: ['phrase'],
  evidenceEligiblePhraseIds: ['phrase'],
  transcript: 'I can use this phrase naturally in a complete response.', durationSeconds: 6,
  recordingId: 'recording', mimeType: 'audio/webm', targetFormVisible: false, supportUsed: false,
  selfRating: { clarity: 4, flow: 4 }, createdAt: '2026-07-16T12:00:00.000Z',
}

const template = createSeedData().phrases[0]
function targetPhrase(id: string, canonical: string): Phrase {
  return {
    ...template,
    id,
    canonical,
    normalizedKey: canonical.toLocaleLowerCase('en-US'),
    meaning: `use ${canonical} naturally`,
    context: `I ${canonical} in a complete example.`,
    acceptedForms: [],
    createdAt: '2026-07-01T08:00:00.000Z',
    activationEvents: undefined,
  }
}
const mainTarget = targetPhrase('phrase', 'use this phrase')
mainTarget.activationError = {
  incorrectContext: 'I use use this phrase in a complete example.',
  expectedCorrection: mainTarget.context,
  cue: 'Remove the repeated verb.',
}
mainTarget.activationEvents = qualifiedEventsThrough(mainTarget, 6)
const targets = [mainTarget]

describe('spoken evidence eligibility', () => {
  it('requires contextual production rather than a bare target', () => {
    const now = new Date('2026-07-16T13:00:00.000Z')
    expect(speakingEvidencePhraseIds(base, targets, now)).toEqual(['phrase'])
    expect(speakingEvidencePhraseIds({ ...base, transcript: 'bear in mind', durationSeconds: 2 }, targets, now)).toEqual([])
  })

  it('rejects a long target alone or repeated without outside context', () => {
    const now = new Date('2026-07-16T13:00:00.000Z')
    const longTarget = [targetPhrase('phrase', 'as far as I am able to tell')]
    expect(speakingEvidencePhraseIds({ ...base, transcript: 'As far as I am able to tell.' }, longTarget, now)).toEqual([])
    expect(speakingEvidencePhraseIds({ ...base, transcript: 'However however however however however however however.' }, [targetPhrase('phrase', 'however')], now)).toEqual([])
  })

  it('does not count another assigned target as outside context', () => {
    const now = new Date('2026-07-16T13:00:00.000Z')
    const assigned = [
      targetPhrase('phrase', 'on the other hand'),
      targetPhrase('second', 'as a matter of fact'),
    ]
    const attempt = {
      ...base,
      targetPhraseIds: ['phrase', 'second'],
      detectedPhraseIds: ['phrase', 'second'],
      confirmedPhraseIds: ['phrase'],
      transcript: 'On the other hand, as a matter of fact.',
    }
    expect(speakingEvidencePhraseIds(attempt, assigned, now)).toEqual([])
  })

  it('keeps future imported attempts out of evidence', () => {
    expect(speakingEvidencePhraseIds(base, targets, new Date('2026-07-16T11:00:00.000Z'))).toEqual([])
  })

  it('keeps attempts dated before phrase creation out of evidence', () => {
    const createdLater = targets.map((phrase) => ({ ...phrase, createdAt: '2026-07-17T12:00:00.000Z' }))
    expect(speakingEvidencePhraseIds(base, createdLater, new Date('2026-07-18T12:00:00.000Z'))).toEqual([])
  })

  it('rejects legacy attempts without verified target visibility', () => {
    const now = new Date('2026-07-16T13:00:00.000Z')
    expect(speakingEvidencePhraseIds({ ...base, targetFormVisible: undefined }, targets, now)).toEqual([])
    expect(speakingEvidencePhraseIds({ ...base, targetFormVisible: true }, targets, now)).toEqual([])
  })

  it('does not count a take saved before the six pre-speaking activation stages', () => {
    const now = new Date('2026-07-16T13:00:00.000Z')
    expect(speakingEvidencePhraseIds({ ...base, evidenceEligiblePhraseIds: [] }, targets, now)).toEqual([])
    expect(speakingEvidencePhraseIds({ ...base, evidenceEligiblePhraseIds: undefined }, targets, now)).toEqual([])
    expect(speakingEvidencePhraseIds(base, targets.map((phrase) => ({ ...phrase, activationEvents: undefined })), now)).toEqual([])
  })

  it('recomputes transcript detection instead of trusting imported derived ids', () => {
    const now = new Date('2026-07-16T13:00:00.000Z')
    const forged = { ...base, transcript: 'This unrelated recording has enough surrounding words to look plausible.' }
    expect(speakingEvidencePhraseIds(forged, targets, now)).toEqual([])
  })

  it('completes the daily speaking route only with a substantive unsupported recording', () => {
    const now = new Date('2026-07-16T13:00:00.000Z')
    const generic = { ...base, targetPhraseIds: [], detectedPhraseIds: [], confirmedPhraseIds: [], evidenceEligiblePhraseIds: [], transcript: 'A useful recorded response without a lexical target.' }
    expect(isCompletedSpeakingPractice(generic, now)).toBe(true)
    expect(speakingEvidencePhraseIds(generic, targets, now)).toEqual([])
    expect(isCompletedSpeakingPractice({ ...generic, recordingId: undefined }, now)).toBe(false)
    expect(isCompletedSpeakingPractice({ ...generic, mode: 'shadowing' }, now)).toBe(false)
    expect(isCompletedSpeakingPractice({ ...generic, durationSeconds: 1 }, now)).toBe(false)
    expect(isCompletedSpeakingPractice({ ...generic, transcript: '' }, now)).toBe(false)
    expect(isCompletedSpeakingPractice({ ...generic, supportUsed: true }, now)).toBe(false)
  })
})
