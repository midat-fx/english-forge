import { describe, expect, it } from 'vitest'
import type { ErrorAttempt, ErrorPattern } from './types'
import { deriveErrorEvidence, errorAnswerContractFingerprint, errorAttemptContractSnapshot } from './errorEvidence'

const baseInput: ErrorPattern = {
  id: 'error-test',
  label: 'Preposition after listen',
  category: 'prepositions',
  original: 'I listened him.',
  correction: 'I listened to him.',
  hint: 'Check the preposition.',
  rule: 'Listen takes to.',
  transferPrompt: 'Repair: We listened the speaker.',
  transferAnswer: 'We listened to the speaker.',
  occurrences: 1,
  status: 'active',
  dueAt: '2026-07-01T08:00:00.000Z',
  cycleStartedAt: '2026-07-01T08:00:00.000Z',
  attempts: [],
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-07-01T08:00:00.000Z',
}
const base: ErrorPattern = {
  ...baseInput,
  evidenceVersion: 1,
  answerContractFingerprint: errorAnswerContractFingerprint(baseInput),
  answerContractUpdatedAt: baseInput.createdAt,
  observations: [{ id: 'initial', observedAt: baseInput.createdAt, evidenceVersion: 1 }],
}

function attempt(input: Partial<ErrorAttempt> & Pick<ErrorAttempt, 'id' | 'response' | 'attemptedAt'>): ErrorAttempt {
  const transfer = input.transfer ?? false
  return { correct: true, supportUsed: false, transfer, ...errorAttemptContractSnapshot(base, transfer), ...input }
}

describe('Error Lab evidence derivation', () => {
  it('downgrades empty or answer-forged mastery claims', () => {
    const empty = deriveErrorEvidence({ ...base, status: 'resolved', dueAt: '2099-01-01T00:00:00.000Z' }, new Date('2026-07-20T08:00:00.000Z')).pattern
    expect(empty).toMatchObject({ status: 'active', dueAt: base.cycleStartedAt })

    const forged = deriveErrorEvidence({
      ...base,
      status: 'resolved',
      attempts: [
        attempt({ id: 'three', response: 'Wrong transfer.', transfer: true, attemptedAt: '2026-07-10T08:00:00.000Z' }),
        attempt({ id: 'two', response: 'Still wrong.', attemptedAt: '2026-07-03T08:00:00.000Z' }),
        attempt({ id: 'one', response: 'Wrong.', attemptedAt: '2026-07-02T08:00:00.000Z' }),
      ],
    }, new Date('2026-07-20T08:00:00.000Z')).pattern
    expect(forged.status).toBe('active')
    expect(forged.attempts.every((item) => item.correct === false)).toBe(true)
  })

  it('accepts only a correctly answered and genuinely spaced transfer sequence', () => {
    const validAttempts = [
      attempt({ id: 'transfer', response: base.transferAnswer!, transfer: true, attemptedAt: '2026-07-09T08:00:00.000Z' }),
      attempt({ id: 'second', response: base.correction, attemptedAt: '2026-07-02T08:00:00.000Z' }),
      attempt({ id: 'first', response: base.correction, attemptedAt: '2026-07-01T08:00:00.000Z' }),
    ]
    const resolved = deriveErrorEvidence({ ...base, status: 'resolved', attempts: validAttempts }, new Date('2026-07-20T08:00:00.000Z')).pattern
    expect(resolved).toMatchObject({ status: 'resolved', dueAt: '2026-08-08T08:00:00.000Z' })

    const compressed = deriveErrorEvidence({
      ...base,
      status: 'resolved',
      attempts: validAttempts.map((item, index) => ({ ...item, attemptedAt: `2026-07-01T0${index + 8}:00:00.000Z` })),
    }, new Date('2026-07-20T08:00:00.000Z')).pattern
    expect(compressed.status).not.toBe('resolved')
  })

  it('does not let a mutable answer contract validate old responses retroactively', () => {
    const attempts = [
      attempt({ id: 'transfer', response: base.transferAnswer!, transfer: true, attemptedAt: '2026-07-09T08:00:00.000Z' }),
      attempt({ id: 'second', response: base.correction, attemptedAt: '2026-07-02T08:00:00.000Z' }),
      attempt({ id: 'first', response: base.correction, attemptedAt: '2026-07-01T08:00:00.000Z' }),
    ]
    const changed = deriveErrorEvidence({
      ...base,
      correction: 'I listened him.',
      transferAnswer: 'We listened the speaker.',
      evidenceVersion: 1,
      answerContractFingerprint: errorAnswerContractFingerprint(base),
      answerContractUpdatedAt: base.createdAt,
      status: 'resolved',
      attempts,
    }, new Date('2026-07-20T08:00:00.000Z')).pattern

    expect(changed.status).toBe('active')
    expect(changed.attempts.every((item) => item.correct === false)).toBe(true)
    expect(changed.answerContractUpdatedAt).toBe('2026-07-20T08:00:00.000Z')

    const changedPromptOnly = deriveErrorEvidence({
      ...base,
      transferPrompt: 'Repair an entirely different sentence.',
      status: 'resolved',
      attempts,
    }, new Date('2026-07-20T08:00:00.000Z')).pattern
    expect(changedPromptOnly.status).toBe('active')
    expect(changedPromptOnly.attempts.every((item) => item.correct === false)).toBe(true)
  })

  it('keeps legacy unbound attempts as history but never counts them as repair evidence', () => {
    const legacyAttempts = [
      { ...attempt({ id: 'transfer', response: base.transferAnswer!, transfer: true, attemptedAt: '2026-07-09T08:00:00.000Z' }), evidenceVersion: undefined, answerContractFingerprint: undefined, expectedResponse: undefined },
      { ...attempt({ id: 'second', response: base.correction, attemptedAt: '2026-07-02T08:00:00.000Z' }), evidenceVersion: undefined, answerContractFingerprint: undefined, expectedResponse: undefined },
      { ...attempt({ id: 'first', response: base.correction, attemptedAt: '2026-07-01T08:00:00.000Z' }), evidenceVersion: undefined, answerContractFingerprint: undefined, expectedResponse: undefined },
    ]
    const derived = deriveErrorEvidence({ ...base, status: 'resolved', attempts: legacyAttempts }, new Date('2026-07-20T08:00:00.000Z')).pattern
    expect(derived.attempts).toHaveLength(3)
    expect(derived.attempts.every((item) => item.correct === false)).toBe(true)
    expect(derived.status).toBe('active')
  })

  it('rebuilds occurrences from unique timestamped observations', () => {
    const derived = deriveErrorEvidence({
      ...base,
      occurrences: 99,
      observations: [
        { id: 'new', observedAt: '2026-07-03T08:00:00.000Z', evidenceVersion: 1 },
        { id: 'new', observedAt: '2026-07-04T08:00:00.000Z', evidenceVersion: 1 },
        { id: 'future', observedAt: '2099-07-04T08:00:00.000Z', evidenceVersion: 1 },
      ],
    }, new Date('2026-07-20T08:00:00.000Z')).pattern
    expect(derived.occurrences).toBe(1)
    expect(derived.observations?.map((item) => item.id)).toEqual(['new'])
  })
})
