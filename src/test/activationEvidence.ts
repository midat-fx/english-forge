import { activationEvidenceResponseForStage, type ActivationLearningStage } from '../domain/activation'
import type { Phrase } from '../domain/types'

export function activationEventsThrough(
  phrase: Phrase,
  through: ActivationLearningStage,
  firstDay = 1,
): NonNullable<Phrase['activationEvents']> {
  const requestedStart = new Date(`2026-07-${String(firstDay).padStart(2, '0')}T08:00:00.000Z`).getTime()
  const firstEventAt = Math.max(requestedStart, new Date(phrase.createdAt).getTime())
  return ([1, 2, 3, 4, 5, 6] as ActivationLearningStage[])
    .slice(0, through)
    .map((stage, index) => ({
      stage,
      completedAt: new Date(firstEventAt + index * 86_400_000).toISOString(),
      evidenceVersion: 1,
      response: activationEvidenceResponseForStage(phrase, stage),
      ...(stage === 5 ? { selfConfirmed: true } : {}),
    }))
}
