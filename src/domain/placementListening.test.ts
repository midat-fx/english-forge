import { describe, expect, it } from 'vitest'
import { PLACEMENT_LISTENING_PROMPTS } from '../data/listeningPromptBank'
import {
  derivePlacementListeningResult,
  isCompletePlacementListeningDiagnostic,
  placementDictationWordAccuracy,
  type PlacementListeningDiagnostic,
} from './placementListening'

function perfectDiagnostic(): PlacementListeningDiagnostic {
  return {
    evidenceVersion: 1,
    promptSetVersion: 1,
    answers: PLACEMENT_LISTENING_PROMPTS.map((prompt) => ({
      promptId: prompt.id,
      selectedIndex: prompt.answerIndex,
      dictation: prompt.text,
      playbackCompleted: true,
      replayCount: 0,
    })),
    completedAt: '2026-07-18T12:00:00.000Z',
  }
}

describe('optional placement listening evidence', () => {
  it('derives every score from raw answers without producing a CEFR placement', () => {
    const result = derivePlacementListeningResult(perfectDiagnostic())
    expect(result).toMatchObject({
      comprehension: { correct: 8, total: 8 },
      dictation: { matched: 8, total: 8, averageWordAccuracy: 1 },
      byLevel: {
        A2: { comprehensionCorrect: 2, dictationMatched: 2, total: 2 },
        B1: { comprehensionCorrect: 2, dictationMatched: 2, total: 2 },
        B2: { comprehensionCorrect: 2, dictationMatched: 2, total: 2 },
        C1: { comprehensionCorrect: 2, dictationMatched: 2, total: 2 },
      },
    })
    expect(result).not.toHaveProperty('suggestedLevel')
  })

  it('rejects duplicate, incomplete, unplayed, and out-of-range imported answers', () => {
    const duplicate = perfectDiagnostic()
    duplicate.answers[1] = { ...duplicate.answers[0] }
    expect(isCompletePlacementListeningDiagnostic(duplicate)).toBe(false)

    const unplayed = perfectDiagnostic()
    unplayed.answers[0].playbackCompleted = false
    expect(derivePlacementListeningResult(unplayed)).toBeNull()

    const invalidChoice = perfectDiagnostic()
    invalidChoice.answers[0].selectedIndex = 3
    expect(derivePlacementListeningResult(invalidChoice)).toBeNull()
  })

  it('reports edit-distance accuracy while keeping the stricter 85% dictation gate', () => {
    expect(placementDictationWordAccuracy('the train leaves at eight', 'the train leaves at eight')).toBe(1)
    expect(placementDictationWordAccuracy('the train left at eight', 'the train leaves at eight')).toBeCloseTo(0.8)
    const diagnostic = perfectDiagnostic()
    diagnostic.answers[0].dictation = 'unrelated answer'
    diagnostic.answers[0].selectedIndex = 0
    expect(derivePlacementListeningResult(diagnostic)).toMatchObject({
      comprehension: { correct: 7, total: 8 },
      dictation: { matched: 7, total: 8 },
    })
  })
})
