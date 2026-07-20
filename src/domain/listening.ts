import { includesPhrase, normalizePhrase } from './normalization'
import type { CEFRLevel, ListeningAttempt, Phrase } from './types'

export const LISTENING_EVIDENCE_VERSION = 1 as const

export function normalizedListeningWords(value: string): string[] {
  return normalizePhrase(value).replace(/[^\p{L}\p{N}']+/gu, ' ').trim().split(/\s+/u).filter(Boolean)
}

function wordEditDistance(actual: readonly string[], expected: readonly string[]): number {
  let previous = Array.from({ length: expected.length + 1 }, (_, index) => index)
  for (let actualIndex = 1; actualIndex <= actual.length; actualIndex += 1) {
    const current = [actualIndex]
    for (let expectedIndex = 1; expectedIndex <= expected.length; expectedIndex += 1) {
      current[expectedIndex] = Math.min(
        previous[expectedIndex]! + 1,
        current[expectedIndex - 1]! + 1,
        previous[expectedIndex - 1]! + (actual[actualIndex - 1] === expected[expectedIndex - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[expected.length] ?? expected.length
}

/**
 * Word-aligned match ratio used by both the UI and profile-import validation.
 * The Voice Lab prints the threshold as a `Rule` fraction; it must be derived
 * from this constant, never re-typed as a literal.
 */
export const DICTATION_MATCH_RATIO = 0.85

/** Word-aligned 85% match used by both the UI and profile-import validation. */
export function dictationMatches(response: string, reference: string): boolean {
  const actual = normalizedListeningWords(response)
  const expected = normalizedListeningWords(reference)
  if (!actual.length || !expected.length) return false
  const comparisonLength = Math.max(actual.length, expected.length)
  return (comparisonLength - wordEditDistance(actual, expected)) / comparisonLength >= DICTATION_MATCH_RATIO
}

type ListeningEvidence = Pick<ListeningAttempt,
  | 'response'
  | 'referenceTranscript'
  | 'comprehensionQuestion'
  | 'comprehensionResponse'
  | 'comprehensionExpectedResponse'
>

export interface DerivedListeningResults {
  dictationMatched: boolean
  comprehensionMatched?: boolean
  answerMatched: boolean
  comprehensionComplete: boolean
}

/** Recomputes every result from the learner response and immutable snapshots. */
export function deriveListeningResults(attempt: ListeningEvidence): DerivedListeningResults {
  const dictationMatched = Boolean(attempt.referenceTranscript?.trim())
    && dictationMatches(attempt.response, attempt.referenceTranscript ?? '')
  const comprehensionParts = [
    attempt.comprehensionQuestion,
    attempt.comprehensionResponse,
    attempt.comprehensionExpectedResponse,
  ]
  const comprehensionComplete = comprehensionParts.every((value) => Boolean(value?.trim()))
  const comprehensionStarted = comprehensionParts.some((value) => value !== undefined)
  const comprehensionMatched = comprehensionComplete
    ? normalizePhrase(attempt.comprehensionResponse ?? '') === normalizePhrase(attempt.comprehensionExpectedResponse ?? '')
    : undefined
  return {
    dictationMatched,
    comprehensionMatched,
    answerMatched: dictationMatched && (!comprehensionStarted || comprehensionMatched === true),
    comprehensionComplete,
  }
}

export function listeningAttemptHasVerifiedEvidence(attempt: ListeningAttempt): boolean {
  if (attempt.listeningEvidenceVersion !== LISTENING_EVIDENCE_VERSION || attempt.playbackCompleted !== true) return false
  const derived = deriveListeningResults(attempt)
  const comprehensionStarted = [attempt.comprehensionQuestion, attempt.comprehensionResponse, attempt.comprehensionExpectedResponse, attempt.comprehensionMatched]
    .some((value) => value !== undefined)
  return attempt.answerMatched === derived.answerMatched
    && (!comprehensionStarted || (derived.comprehensionComplete && attempt.comprehensionMatched === derived.comprehensionMatched))
}

export interface ListeningReference {
  id: string
  text: string
  phraseId?: string
  question?: string
  choices?: readonly [string, string, string]
  answerIndex?: 0 | 1 | 2
}

export function selectDailyListeningReference(
  phrases: readonly Phrase[],
  level: CEFRLevel,
  dayKey: string,
  fallback: readonly ListeningReference[],
): ListeningReference {
  const learned = phrases
    .filter((phrase) => phrase.cefr === level && (phrase.status === 'active' || phrase.status === 'retained' || (phrase.status === 'learning' && (phrase.activationStage ?? 0) >= 6)))
    .filter((phrase) => {
      const words = phrase.context.trim().split(/\s+/u).length
      return words >= 6 && words <= 24 && includesPhrase(phrase.context, phrase.canonical, phrase.acceptedForms)
    })
    .sort((left, right) => left.id.localeCompare(right.id))
  const hash = [...`${level}:${dayKey}`].reduce((total, character) => (Math.imul(total, 31) + character.codePointAt(0)!) >>> 0, 17)
  if (learned.length) {
    const phrase = learned[hash % learned.length]
    return { id: `phrase-${phrase.id}`, text: phrase.context, phraseId: phrase.id }
  }
  return fallback[hash % fallback.length]
}
