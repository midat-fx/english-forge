import { listeningAttemptHasVerifiedEvidence } from './listening'
import { completedMissionEvidenceIsValid } from './mission'
import type { ListeningAttempt, Mission, Phrase, PlacementAttempt, SpeakingAttempt } from './types'

export type DiagnosticPortfolioArea = 'listening' | 'speaking' | 'writing'

export interface DiagnosticPortfolioEvidence {
  complete: boolean
  completedAt?: string
}

export interface DiagnosticPortfolioStatus {
  baselineAt?: string
  listening: DiagnosticPortfolioEvidence
  speaking: DiagnosticPortfolioEvidence
  writing: DiagnosticPortfolioEvidence
  completedCount: number
  complete: boolean
}

interface DiagnosticPortfolioData {
  placementAttempts: readonly PlacementAttempt[]
  listeningAttempts: readonly ListeningAttempt[]
  speakingAttempts: readonly SpeakingAttempt[]
  missions: readonly Mission[]
  phrases: readonly Phrase[]
}

function validTimestamp(value?: string): number | undefined {
  if (!value) return undefined
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : undefined
}

function latestAfter<T>(items: readonly T[], baseline: number, cutoff: number, timestamp: (item: T) => string | undefined, qualifies: (item: T) => boolean): string | undefined {
  return items
    .filter(qualifies)
    .map(timestamp)
    .filter((value): value is string => {
      const at = validTimestamp(value)
      return at !== undefined && at > baseline && at <= cutoff
    })
    .sort((left, right) => validTimestamp(right)! - validTimestamp(left)!)[0]
}

export function diagnosticPortfolioStatus(data: DiagnosticPortfolioData, now = new Date()): DiagnosticPortfolioStatus {
  const baselineAt = [...data.placementAttempts]
    .map((attempt) => attempt.completedAt)
    .filter((value) => validTimestamp(value) !== undefined)
    .sort((left, right) => validTimestamp(right)! - validTimestamp(left)!)[0]
  const baseline = validTimestamp(baselineAt) ?? 0
  const cutoff = now.getTime()

  const listeningAt = latestAfter(
    data.listeningAttempts,
    baseline,
    cutoff,
    (attempt) => attempt.createdAt,
    (attempt) => listeningAttemptHasVerifiedEvidence(attempt)
      && attempt.comprehensionMatched === true
      && !attempt.revealUsed
      && Boolean(attempt.referenceTranscript?.trim()),
  )
  const speakingAt = latestAfter(
    data.speakingAttempts,
    baseline,
    cutoff,
    (attempt) => attempt.createdAt,
    (attempt) => attempt.mode === 'targeted_response'
      && Boolean(attempt.recordingId)
      && attempt.durationSeconds >= 30
      && attempt.targetFormVisible === false
      && !attempt.supportUsed
      && (attempt.transcript.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0) >= 20,
  )
  const writingAt = latestAfter(
    data.missions,
    baseline,
    cutoff,
    (mission) => mission.completedAt,
    (mission) => mission.supportUsed === false && completedMissionEvidenceIsValid(mission, data.phrases),
  )
  const status = {
    baselineAt,
    listening: { complete: Boolean(listeningAt), ...(listeningAt ? { completedAt: listeningAt } : {}) },
    speaking: { complete: Boolean(speakingAt), ...(speakingAt ? { completedAt: speakingAt } : {}) },
    writing: { complete: Boolean(writingAt), ...(writingAt ? { completedAt: writingAt } : {}) },
  }
  const completedCount = [status.listening, status.speaking, status.writing].filter((area) => area.complete).length
  return { ...status, completedCount, complete: completedCount === 3 }
}
