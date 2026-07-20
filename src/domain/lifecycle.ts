import { calculatePhraseEvidence, type PhraseEvidenceData } from './progress'
import { isPracticeReadyPhrase } from './dailyVocabulary'
import type { Phrase, PhraseStatus } from './types'

export function derivePhraseStatus(data: PhraseEvidenceData, phrase: Phrase, now = new Date()): PhraseStatus {
  if (phrase.status === 'archived') return 'archived'
  if (!isPracticeReadyPhrase(phrase)) return 'needs_enrichment'
  const evidence = calculatePhraseEvidence(data, phrase.id, now)
  if (evidence.retained) return 'retained'
  if (evidence.activatedAt !== undefined) return 'active'
  const evidenceResetAt = phrase.evidenceResetAt ? new Date(phrase.evidenceResetAt).getTime() : Number.NEGATIVE_INFINITY
  if (data.reviews.some((review) => review.targetType === 'phrase' && review.targetId === phrase.id && new Date(review.reviewedAt).getTime() >= evidenceResetAt && new Date(review.reviewedAt).getTime() <= now.getTime())) return 'learning'
  return 'new'
}
