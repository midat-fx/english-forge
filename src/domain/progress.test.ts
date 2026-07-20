import { describe, expect, it } from 'vitest'
import { createSeedData } from '../data/seed'
import { calculatePhraseEvidence, calculateProgress } from './progress'
import { derivePhraseStatus } from './lifecycle'
import type { Mission, Phrase } from './types'
import type { ReviewEvent } from './types'
import { activationEventsThrough as qualifiedEventsThrough } from '../test/activationEvidence'

function validCompletedMission(template: Mission, phrase: Phrase, createdAt: string, completedAt: string): Mission {
  const response = `We should ${phrase.canonical} while our team reviews the proposal carefully. Everyone will share clear facts, compare the available options, discuss likely risks, and agree on practical next steps before Friday so the final decision is fair, useful, and easy to explain.`
  return {
    ...template,
    level: 'A2',
    targetPhraseIds: [phrase.id],
    targetPhraseCount: 1,
    targetResults: [{ phraseId: phrase.id, confirmed: true }],
    minWords: 40,
    maxWords: 70,
    supportUsed: false,
    legacyContract: false,
    draft: response,
    response,
    status: 'done',
    createdAt,
    completedAt,
    selfConfirmedAt: completedAt,
  }
}

function validProductiveReview(template: ReviewEvent, phrase: Phrase, id: string, reviewedAt: string, supportUsed: boolean | undefined = false): ReviewEvent {
  return {
    ...template,
    id,
    idempotencyKey: id,
    targetId: phrase.id,
    targetType: 'phrase',
    skill: 'written_productive',
    exerciseType: 'constrained_sentence',
    response: `Our carefully reviewed result may ${phrase.canonical} in this new example.`,
    grade: 2,
    hintsUsed: 0,
    revealUsed: false,
    supportUsed,
    reviewedAt,
    dueBefore: new Date(new Date(reviewedAt).getTime() - 86_400_000).toISOString(),
  }
}

describe('honest progress metrics', () => {
  it('does not call captured phrases retained', () => {
    const data = createSeedData()
    const metrics = calculateProgress(data, new Date())
    expect(metrics.captured).toBeGreaterThan(0)
    expect(metrics.retained).toBe(0)
  })

  it('counts the Voice-only spoken lane in visible review debt', () => {
    const data = createSeedData()
    const now = new Date('2026-07-20T12:00:00.000Z')
    const phrase = { ...data.phrases[0], activationStage: 7 as const }
    phrase.activationEvents = qualifiedEventsThrough(phrase, 6)
    data.phrases = [phrase]
    data.skillStates = [
      { ...data.skillStates[0], phraseId: phrase.id, skill: 'meaning_recall', dueAt: '2026-07-20T08:00:00.000Z' },
      { ...data.skillStates[0], phraseId: phrase.id, skill: 'spoken_productive', dueAt: '2026-07-20T08:00:00.000Z' },
    ]

    expect(calculateProgress(data, now)).toMatchObject({ due: 2, spokenDue: 1 })
  })

  it('requires two spaced productive recalls and the complete activation cycle for provisional status', () => {
    const data = createSeedData()
    data.phrases[0] = { ...data.phrases[0], activationStage: 8, activationUpdatedAt: '2026-07-18T07:00:00.000Z' }
    const now = new Date('2026-07-18T12:00:00.000Z')
    data.reviews.push(
      validProductiveReview(data.reviews[0], data.phrases[0], 'extra-1', '2026-07-17T08:00:00.000Z'),
      validProductiveReview(data.reviews[0], data.phrases[0], 'extra-2', '2026-07-18T08:00:00.000Z'),
    )
    expect(calculateProgress(data, now).provisional).toBe(1)
  })

  it('accepts a confirmed Mission as optional productive-transfer evidence', () => {
    const data = createSeedData()
    data.phrases[0] = { ...data.phrases[0], cefr: 'A2', activationStage: 8, activationUpdatedAt: '2026-07-18T07:00:00.000Z' }
    data.phrases[0].activationEvents = qualifiedEventsThrough(data.phrases[0], 5)
    data.reviews.push(validProductiveReview(data.reviews[0], data.phrases[0], 'mission-alt-1', '2026-07-17T08:00:00.000Z'))
    data.missions[0] = validCompletedMission(data.missions[0], data.phrases[0], '2026-07-17T12:00:00.000Z', '2026-07-18T09:00:00.000Z')
    expect(calculateProgress(data, new Date('2026-07-18T12:00:00.000Z')).provisional).toBe(1)
  })

  it('requires an explicit unsupported flag on written productive reviews', () => {
    const data = createSeedData()
    const phraseId = data.phrases[0].id
    data.phrases[0] = { ...data.phrases[0], activationStage: 8, activationUpdatedAt: '2026-07-16T08:00:00.000Z' }
    const base = data.reviews[0]
    data.missions = []
    data.reviews = [
      { ...validProductiveReview(base, data.phrases[0], 'legacy-guided', '2026-07-17T08:00:00.000Z'), supportUsed: undefined },
      validProductiveReview(base, data.phrases[0], 'explicit-supported', '2026-07-18T08:00:00.000Z', true),
      validProductiveReview(base, data.phrases[0], 'explicit-unsupported', '2026-07-19T08:00:00.000Z'),
    ]
    const now = new Date('2026-07-20T08:00:00.000Z')

    expect(calculatePhraseEvidence(data, phraseId, now).productivePasses).toBe(1)
    expect(calculateProgress(data, now).provisional).toBe(0)

    data.reviews[0] = { ...data.reviews[0], supportUsed: false }
    expect(calculatePhraseEvidence(data, phraseId, now).productivePasses).toBe(2)
    expect(calculateProgress(data, now).provisional).toBe(1)
  })

  it('excludes a written review contaminated by another same-phrase review inside twelve hours', () => {
    const data = createSeedData()
    const phrase = { ...data.phrases[0], activationStage: 8, activationUpdatedAt: '2026-07-18T09:00:00.000Z', practiceExposures: undefined }
    const written = validProductiveReview(data.reviews[0], phrase, 'written-after-exposure', '2026-07-18T09:00:00.000Z')
    const priorMeaning = {
      ...written,
      id: 'prior-meaning',
      idempotencyKey: 'prior-meaning',
      skill: 'meaning_recall' as const,
      exerciseType: 'meaning_to_chunk' as const,
      response: phrase.canonical,
      reviewedAt: '2026-07-18T08:55:00.000Z',
    }
    data.phrases[0] = phrase
    data.missions = []
    data.speakingAttempts = []
    data.reviews = [written, priorMeaning]

    expect(calculatePhraseEvidence(data, phrase.id, new Date('2026-07-19T09:00:00.000Z')).productivePasses).toBe(0)
    data.reviews = [written]
    expect(calculatePhraseEvidence(data, phrase.id, new Date('2026-07-19T09:00:00.000Z')).productivePasses).toBe(1)
  })

  it('does not award productive evidence for an empty or unrelated saved response', () => {
    const data = createSeedData()
    const phrase = data.phrases[0]
    data.reviews = [{
      ...data.reviews[0], id: 'forged', idempotencyKey: 'forged', targetId: phrase.id,
      response: '', reviewedAt: '2026-07-17T08:00:00.000Z', dueBefore: '2026-07-16T08:00:00.000Z',
    }]

    expect(calculatePhraseEvidence(data, phrase.id, new Date('2026-07-18T00:00:00.000Z')).productivePasses).toBe(0)
  })

  it('does not award productive evidence dated before phrase creation', () => {
    const data = createSeedData()
    const phrase = { ...data.phrases[0], createdAt: '2026-07-18T08:00:00.000Z', evidenceResetAt: undefined }
    data.phrases[0] = phrase
    data.reviews = [validProductiveReview(data.reviews[0], phrase, 'pre-creation', '2026-07-17T08:00:00.000Z')]
    expect(calculatePhraseEvidence(data, phrase.id, new Date('2026-07-19T08:00:00.000Z')).productivePasses).toBe(0)
  })

  it('does not count legacy or supported Missions as productive transfer', () => {
    const data = createSeedData()
    const phraseId = data.phrases[0].id
    data.phrases[0] = { ...data.phrases[0], cefr: 'A2', activationStage: 5 }
    data.phrases[0].activationEvents = qualifiedEventsThrough(data.phrases[0], 5)
    data.reviews = []
    data.missions[0] = { ...validCompletedMission(data.missions[0], data.phrases[0], '2026-07-17T12:00:00.000Z', '2026-07-18T09:00:00.000Z'), supportUsed: undefined }
    const now = new Date('2026-07-18T12:00:00.000Z')

    expect(calculateProgress(data, now).phrasesUsedInMissions).toBe(0)
    expect(calculatePhraseEvidence(data, phraseId, now).missionCompletedAt).toBeUndefined()

    data.missions[0] = { ...data.missions[0], supportUsed: true }
    expect(calculateProgress(data, now).phrasesUsedInMissions).toBe(0)

    data.missions[0] = { ...data.missions[0], supportUsed: false }
    expect(calculateProgress(data, now).phrasesUsedInMissions).toBe(1)
    expect(calculatePhraseEvidence(data, phraseId, now).missionCompletedAt).toBeDefined()
  })

  it('requires a new unsupported productive pass 30 days after activation for retention', () => {
    const data = createSeedData()
    const now = new Date('2026-06-30T12:00:00.000Z')
    const phraseId = data.phrases[0].id
    data.phrases[0] = { ...data.phrases[0], createdAt: '2026-04-01T12:00:00.000Z', activationStage: 8, activationUpdatedAt: '2026-05-03T12:00:00.000Z' }
    const base = data.reviews[0]
    data.reviews = [
      validProductiveReview(base, data.phrases[0], 'p1', '2026-05-01T12:00:00.000Z'),
      validProductiveReview(base, data.phrases[0], 'p2', '2026-05-02T12:00:00.000Z'),
    ]
    data.missions[0] = { ...data.missions[0], status: 'done', completedAt: '2026-05-03T12:00:00.000Z', selfConfirmedAt: '2026-05-03T12:00:00.000Z', response: 'A self-checked mission response.', targetPhraseIds: [phraseId], targetResults: [{ phraseId, confirmed: true }] }
    expect(calculateProgress(data, now).retained).toBe(0)
    data.reviews.push(validProductiveReview(base, data.phrases[0], 'delayed', '2026-06-05T12:00:00.000Z'))
    expect(calculateProgress(data, now).retained).toBe(1)
  })

  it('derives review counts from immutable events rather than screen state', () => {
    const data = createSeedData()
    const first = calculateProgress(data)
    const second = calculateProgress(data)
    expect(second.reviewedThisWeek).toBe(first.reviewedThisWeek)
  })

  it('derives active and retained lifecycle even when mission evidence arrives first', () => {
    const data = createSeedData()
    const phrase = { ...data.phrases[0], createdAt: '2025-12-01T12:00:00.000Z', status: 'new' as const, activationStage: 8, activationUpdatedAt: '2026-01-03T12:00:00.000Z' }
    data.phrases[0] = phrase
    const base = data.reviews[0]
    data.reviews = [
      validProductiveReview(base, phrase, 'later-1', '2026-01-02T12:00:00.000Z'),
      validProductiveReview(base, phrase, 'later-2', '2026-01-03T12:00:00.000Z'),
    ]
    data.missions[0] = { ...data.missions[0], status: 'done', completedAt: '2026-01-01T12:00:00.000Z', selfConfirmedAt: '2026-01-01T12:00:00.000Z', response: 'A self-checked mission response.', targetPhraseIds: [phrase.id], targetResults: [{ phraseId: phrase.id, confirmed: true }] }
    expect(derivePhraseStatus(data, phrase, new Date('2026-01-04T12:00:00.000Z'))).toBe('active')
    data.reviews.push(validProductiveReview(base, phrase, 'delayed-lifecycle', '2026-02-03T12:00:00.000Z'))
    expect(derivePhraseStatus(data, phrase, new Date('2026-02-04T12:00:00.000Z'))).toBe('retained')
  })

  it('does not treat a transcript-only log as recorded speaking evidence', () => {
    const data = createSeedData()
    const phraseId = data.phrases[0].id
    data.speakingAttempts.push({
      id: 'manual', idempotencyKey: 'manual', sessionId: 'manual-session', mode: 'targeted_response', prompt: 'Respond.',
      targetPhraseIds: [phraseId], detectedPhraseIds: [phraseId], confirmedPhraseIds: [phraseId], transcript: data.phrases[0].canonical,
      durationSeconds: 5, targetFormVisible: false, supportUsed: false, selfRating: { clarity: 5, flow: 5 }, createdAt: new Date().toISOString(),
    })
    const metrics = calculateProgress(data)
    expect(metrics.speakingAttempts).toBe(1)
    expect(metrics.speakingMinutes).toBe(0)
    expect(metrics.phrasesUsedInSpeech).toBe(0)
  })

  it('keeps supported and early 4/3/2 activity out of spoken evidence metrics', () => {
    const data = createSeedData()
    const phraseId = data.phrases[0].id
    const base = {
      id: 'spoken', idempotencyKey: 'spoken', sessionId: 'spoken-family', mode: 'targeted_response' as const, prompt: 'Respond.',
      targetPhraseIds: [phraseId], detectedPhraseIds: [phraseId], confirmedPhraseIds: [phraseId], transcript: data.phrases[0].canonical,
      durationSeconds: 10, recordingId: 'spoken_audio', mimeType: 'audio/webm', targetFormVisible: false, supportUsed: true, selfRating: { clarity: 4 as const, flow: 4 as const }, createdAt: new Date().toISOString(),
    }
    data.speakingAttempts.push(base)
    expect(calculateProgress(data).phrasesUsedInSpeech).toBe(0)
  })

  it('does not promote back-to-back recordings or an unfinished activation cycle', () => {
    const data = createSeedData()
    const phrase = { ...data.phrases[0], activationStage: 7 }
    data.phrases[0] = phrase
    data.reviews = []
    const base = {
      idempotencyKey: 'spoken-a', sessionId: 'same-family', mode: 'targeted_response' as const, prompt: 'Respond.',
      targetPhraseIds: [phrase.id], detectedPhraseIds: [phrase.id], confirmedPhraseIds: [phrase.id], transcript: phrase.canonical,
      durationSeconds: 10, recordingId: 'spoken_audio', mimeType: 'audio/webm', targetFormVisible: false, supportUsed: false,
      selfRating: { clarity: 5 as const, flow: 5 as const }, createdAt: '2026-07-18T08:00:00.000Z',
    }
    data.speakingAttempts = [
      { ...base, id: 'spoken-a' },
      { ...base, id: 'spoken-b', idempotencyKey: 'spoken-b', createdAt: '2026-07-18T08:05:00.000Z' },
    ]
    data.missions[0] = { ...data.missions[0], status: 'done', completedAt: '2026-07-18T09:00:00.000Z', selfConfirmedAt: '2026-07-18T09:00:00.000Z', response: 'A self-checked mission response.', targetPhraseIds: [phrase.id], targetResults: [{ phraseId: phrase.id, confirmed: true }] }
    expect(calculateProgress(data, new Date('2026-07-19T12:00:00.000Z')).provisional).toBe(0)
  })

  it('anchors the 30-day retention clock to completion of activation step 8', () => {
    const data = createSeedData()
    const phrase = { ...data.phrases[0], createdAt: '2026-04-01T12:00:00.000Z', activationStage: 8, activationUpdatedAt: '2026-06-20T12:00:00.000Z' }
    data.phrases[0] = phrase
    const base = data.reviews[0]
    data.reviews = [
      validProductiveReview(base, phrase, 'old-1', '2026-05-01T12:00:00.000Z'),
      validProductiveReview(base, phrase, 'old-2', '2026-05-02T12:00:00.000Z'),
      validProductiveReview(base, phrase, 'too-early-for-stage8', '2026-06-10T12:00:00.000Z'),
    ]
    data.missions[0] = { ...data.missions[0], status: 'done', completedAt: '2026-05-03T12:00:00.000Z', selfConfirmedAt: '2026-05-03T12:00:00.000Z', response: 'A self-checked mission response.', targetPhraseIds: [phrase.id], targetResults: [{ phraseId: phrase.id, confirmed: true }] }
    expect(calculateProgress(data, new Date('2026-07-10T12:00:00.000Z')).retained).toBe(0)
    data.reviews.push(validProductiveReview(base, phrase, 'after-stage8', '2026-07-21T12:00:00.000Z'))
    expect(calculateProgress(data, new Date('2026-07-22T12:00:00.000Z')).retained).toBe(1)
  })
})
