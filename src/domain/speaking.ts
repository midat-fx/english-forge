import type { Phrase, SpeakingAttempt } from './types'
import { hasQualifiedActivationThrough, type ActivationEvidencePhrase } from './activation'
import { includesPhrase } from './normalization'

export const MIN_EVIDENCE_SECONDS = 5
export const MIN_EVIDENCE_WORDS = 7
export const MIN_CONTEXT_WORDS = 3

type EvidencePhrase = Pick<Phrase, 'id'> & ActivationEvidencePhrase

function words(value: string): string[] {
  return (value.toLocaleLowerCase('en-US').match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [])
    .map((word) => word.replaceAll('’', "'"))
}

function removeSequence(source: string[], sequence: string[]): string[] {
  if (!sequence.length || sequence.length > source.length) return source
  const result = [...source]
  for (let index = 0; index <= result.length - sequence.length;) {
    const matches = sequence.every((word, offset) => result[index + offset] === word)
    if (matches) result.splice(index, sequence.length)
    else index += 1
  }
  return result
}

function contextualWordCount(transcript: string, targets: EvidencePhrase[]): number {
  const targetForms = targets
    .flatMap((phrase) => [phrase.canonical, ...phrase.acceptedForms])
    .map(words)
    .filter((form) => form.length > 0)
    .sort((left, right) => right.length - left.length)
  return targetForms.reduce(removeSequence, words(transcript)).length
}

export function speakingEvidencePhraseIds(attempt: SpeakingAttempt, phrases: EvidencePhrase[], now = new Date()): string[] {
  const wordCount = words(attempt.transcript).length
  if (
    !attempt.recordingId
    || attempt.targetFormVisible !== false
    || attempt.supportUsed
    || attempt.mode === 'shadowing'
    || (attempt.mode === 'fluency_432' && attempt.round !== 3)
    || attempt.durationSeconds < MIN_EVIDENCE_SECONDS
    || wordCount < MIN_EVIDENCE_WORDS
    || new Date(attempt.createdAt).getTime() > now.getTime()
  ) return []
  const detected = new Set(attempt.detectedPhraseIds)
  const evidenceEligible = new Set(attempt.evidenceEligiblePhraseIds ?? [])
  const confirmed = [...new Set(attempt.confirmedPhraseIds.filter((id) => detected.has(id) && evidenceEligible.has(id)))]
  const confirmedTargets = confirmed
    .map((id) => phrases.find((phrase) => phrase.id === id))
    .filter((phrase): phrase is EvidencePhrase => Boolean(phrase))
    .filter((phrase) => hasQualifiedActivationThrough(phrase, 6, new Date(attempt.createdAt)))
    // detected/confirmed ids are derived metadata and can be forged in an
    // imported profile. Recompute the decisive fact from the transcript.
    .filter((phrase) => includesPhrase(attempt.transcript, phrase.canonical, phrase.acceptedForms))
  const assignedTargets = attempt.targetPhraseIds
    .map((id) => phrases.find((phrase) => phrase.id === id))
    .filter((phrase): phrase is EvidencePhrase => Boolean(phrase))
  if (contextualWordCount(attempt.transcript, assignedTargets) < MIN_CONTEXT_WORDS) return []
  const transcriptConfirmedTargets = new Set(confirmedTargets.map((phrase) => phrase.id))
  const attemptedAt = new Date(attempt.createdAt).getTime()
  return confirmed.filter((id) => {
    const phrase = confirmedTargets.find((item) => item.id === id)
    const createdAt = phrase ? new Date(phrase.createdAt).getTime() : Number.POSITIVE_INFINITY
    const resetAt = phrase?.evidenceResetAt ? Math.max(createdAt, new Date(phrase.evidenceResetAt).getTime()) : createdAt
    return transcriptConfirmedTargets.has(id) && attemptedAt >= resetAt
  })
}

export function isSpeakingEvidenceAttempt(attempt: SpeakingAttempt, phrases: EvidencePhrase[], now = new Date()): boolean {
  return speakingEvidencePhraseIds(attempt, phrases, now).length > 0
}

/** Daily-route completion is a substantive unsupported take, not lexical mastery evidence. */
export function isCompletedSpeakingPractice(attempt: SpeakingAttempt, now = new Date()): boolean {
  return attempt.mode !== 'shadowing'
    && Boolean(attempt.recordingId)
    && attempt.durationSeconds >= MIN_EVIDENCE_SECONDS
    && Boolean(attempt.prompt.trim())
    && attempt.targetFormVisible === false
    && attempt.supportUsed === false
    && words(attempt.transcript).length >= MIN_EVIDENCE_WORDS
    && new Date(attempt.createdAt).getTime() <= now.getTime()
}

export function samePhraseTargets(left: string[], right: string[]): boolean {
  const sortedLeft = [...left].sort()
  const sortedRight = [...right].sort()
  return sortedLeft.length === sortedRight.length && sortedLeft.every((id, index) => id === sortedRight[index])
}
