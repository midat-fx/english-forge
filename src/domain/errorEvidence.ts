import { normalizePhrase } from './normalization'
import type { ErrorAttempt, ErrorObservation, ErrorPattern } from './types'

const RETRY_DELAY_MS = 10 * 60 * 1_000
const FIRST_REPAIR_DELAY_MS = 24 * 60 * 60 * 1_000
const TRANSFER_DELAY_MS = 7 * FIRST_REPAIR_DELAY_MS
const RESOLVED_DELAY_MS = 30 * FIRST_REPAIR_DELAY_MS

type ErrorAnswerContract = Pick<ErrorPattern, 'original' | 'correction' | 'transferPrompt' | 'transferAnswer'>

export interface DerivedErrorEvidence {
  pattern: ErrorPattern
  latestAcceptedAttempt?: ErrorAttempt
}

/** Stable identity for the exact repair and transfer answers accepted right now. */
export function errorAnswerContractFingerprint(pattern: ErrorAnswerContract): string {
  return `error-answer-v1:${JSON.stringify([
    normalizePhrase(pattern.original),
    normalizePhrase(pattern.correction),
    normalizePhrase(pattern.transferPrompt),
    normalizePhrase(pattern.transferAnswer ?? ''),
  ])}`
}

export function errorAttemptContractSnapshot(
  pattern: ErrorAnswerContract,
  transfer: boolean,
): Pick<ErrorAttempt, 'evidenceVersion' | 'answerContractFingerprint' | 'expectedResponse'> {
  return {
    evidenceVersion: 1,
    answerContractFingerprint: errorAnswerContractFingerprint(pattern),
    expectedResponse: transfer ? pattern.transferAnswer ?? '' : pattern.correction,
  }
}

/** Recompute the answer result and require the immutable contract snapshot. */
export function errorAttemptResponseMatches(
  pattern: ErrorAnswerContract,
  attempt: Pick<ErrorAttempt, 'response' | 'transfer' | 'evidenceVersion' | 'answerContractFingerprint' | 'expectedResponse'>,
): boolean {
  const expected = attempt.transfer ? pattern.transferAnswer : pattern.correction
  const fingerprint = errorAnswerContractFingerprint(pattern)
  return Boolean(expected?.trim())
    && attempt.evidenceVersion === 1
    && attempt.answerContractFingerprint === fingerprint
    && normalizePhrase(attempt.expectedResponse ?? '') === normalizePhrase(expected ?? '')
    && normalizePhrase(attempt.response) === normalizePhrase(expected ?? '')
}

function sortedRecomputedAttempts(pattern: ErrorPattern): ErrorAttempt[] {
  return pattern.attempts
    .map((attempt, index) => ({
      index,
      attempt: {
        ...attempt,
        correct: errorAttemptResponseMatches(pattern, attempt),
      },
    }))
    .sort((left, right) => {
      const timeDifference = new Date(right.attempt.attemptedAt).getTime() - new Date(left.attempt.attemptedAt).getTime()
      return timeDifference || left.index - right.index
    })
    .map(({ attempt }) => attempt)
}

/**
 * Rebuild Error Lab status and scheduling from timestamped responses.
 *
 * Attempts remain visible history, but only unique, chronological attempts in
 * the current cycle and at or before `now` can change evidence. A successful
 * sequence is two independently typed repairs, at least a day apart, followed
 * by a due transfer at least seven days later.
 */
export function deriveErrorEvidence(pattern: ErrorPattern, now = new Date()): DerivedErrorEvidence {
  const nowTime = now.getTime()
  const createdAt = Math.min(new Date(pattern.createdAt).getTime(), nowTime)
  const currentFingerprint = errorAnswerContractFingerprint(pattern)
  const hasCurrentContract = pattern.evidenceVersion === 1
    && pattern.answerContractFingerprint === currentFingerprint
    && Boolean(pattern.answerContractUpdatedAt)
  const requestedContractUpdatedAt = hasCurrentContract ? new Date(pattern.answerContractUpdatedAt!).getTime() : nowTime
  const answerContractUpdatedAt = Math.min(Math.max(createdAt, requestedContractUpdatedAt), nowTime)

  const observationCandidates = pattern.observations ?? []
  const observationIds = new Set<string>()
  const observations = observationCandidates
    .filter((observation) => {
      const observedAt = new Date(observation.observedAt).getTime()
      if (observation.evidenceVersion !== 1 || observationIds.has(observation.id) || !Number.isFinite(observedAt) || observedAt < createdAt || observedAt > nowTime) return false
      observationIds.add(observation.id)
      return true
    })
    .sort((left, right) => right.observedAt.localeCompare(left.observedAt) || left.id.localeCompare(right.id))
  if (!observations.length) observations.push({ id: `${pattern.id}:initial-observation`, observedAt: new Date(createdAt).toISOString(), evidenceVersion: 1 })
  const latestObservationAt = new Date(observations[0].observedAt).getTime()
  const cycleStartedAt = Math.max(latestObservationAt, answerContractUpdatedAt)
  const attempts = sortedRecomputedAttempts(pattern)

  let status: ErrorPattern['status'] = pattern.status === 'observed' ? 'observed' : 'active'
  let dueAt = cycleStartedAt
  let unaidedStreak = 0
  let latestAcceptedAttempt: ErrorAttempt | undefined
  const acceptedIds = new Set<string>()

  for (const attempt of [...attempts].reverse()) {
    const attemptedAt = new Date(attempt.attemptedAt).getTime()
    if (acceptedIds.has(attempt.id) || attemptedAt < cycleStartedAt || attemptedAt > nowTime || status === 'resolved') continue
    acceptedIds.add(attempt.id)

    // Runtime never saves a transfer before it is due or before the pattern
    // reaches improving. It also spaces any attempt after a correct response.
    const transferIsEligible = attempt.transfer && status === 'improving' && attemptedAt >= dueAt
    const blockedBySpacing = attempt.transfer
      ? !transferIsEligible
      : Boolean(latestAcceptedAttempt?.correct) && attemptedAt < dueAt
    if (blockedBySpacing) continue

    latestAcceptedAttempt = attempt
    if (!attempt.correct) {
      status = 'active'
      unaidedStreak = 0
      dueAt = attemptedAt + RETRY_DELAY_MS
      continue
    }

    if (attempt.supportUsed) {
      unaidedStreak = 0
      dueAt = attemptedAt + RETRY_DELAY_MS
      continue
    }

    unaidedStreak += 1
    if (attempt.transfer && transferIsEligible && unaidedStreak >= 3) {
      status = 'resolved'
      dueAt = attemptedAt + RESOLVED_DELAY_MS
    } else if (unaidedStreak >= 2) {
      status = 'improving'
      dueAt = attemptedAt + TRANSFER_DELAY_MS
    } else {
      status = 'active'
      dueAt = attemptedAt + FIRST_REPAIR_DELAY_MS
    }
  }

  return {
    pattern: {
      ...pattern,
      evidenceVersion: 1,
      answerContractFingerprint: currentFingerprint,
      answerContractUpdatedAt: new Date(answerContractUpdatedAt).toISOString(),
      observations: observations as ErrorObservation[],
      occurrences: observations.length,
      ...(pattern.observations === undefined && pattern.occurrences > 1
        ? { legacyOccurrences: Math.max(pattern.legacyOccurrences ?? 1, pattern.occurrences) }
        : {}),
      attempts,
      status,
      dueAt: new Date(dueAt).toISOString(),
      ...(pattern.cycleStartedAt || attempts.length ? { cycleStartedAt: new Date(cycleStartedAt).toISOString() } : {}),
    },
    latestAcceptedAttempt,
  }
}
