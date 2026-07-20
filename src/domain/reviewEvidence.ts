import { responseMatchesPractice } from './practice'
import { phraseHasRecentPracticeExposure } from './queue'
import type { Phrase, ReviewEvent } from './types'

/** Recomputes productive recall from its raw response and immutable metadata. */
export function isIndependentWrittenProductiveEvidence(
  review: ReviewEvent,
  phrase: Phrase,
  reviews: readonly ReviewEvent[],
  at = new Date(),
): boolean {
  const reviewedAt = new Date(review.reviewedAt).getTime()
  const dueBefore = new Date(review.dueBefore).getTime()
  const createdAt = new Date(phrase.createdAt).getTime()
  const resetAt = phrase.evidenceResetAt
    ? Math.max(createdAt, new Date(phrase.evidenceResetAt).getTime())
    : createdAt
  return review.targetType === 'phrase'
    && review.targetId === phrase.id
    && review.skill === 'written_productive'
    && review.exerciseType === 'constrained_sentence'
    && review.grade >= 2
    && review.hintsUsed === 0
    && !review.revealUsed
    && review.supportUsed === false
    && Number.isFinite(reviewedAt)
    && Number.isFinite(dueBefore)
    && reviewedAt >= resetAt
    && reviewedAt <= at.getTime()
    && dueBefore <= reviewedAt
    && !phraseHasRecentPracticeExposure(phrase, reviews, new Date(reviewedAt), review.idempotencyKey)
    && responseMatchesPractice(phrase, 'written_productive', review.response)
}
