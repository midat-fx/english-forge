import { PLACEMENT_LISTENING_PROMPTS, type ListeningPrompt } from '../data/listeningPromptBank'
import { dictationMatches, normalizedListeningWords } from './listening'

export const PLACEMENT_LISTENING_EVIDENCE_VERSION = 1 as const
export const PLACEMENT_LISTENING_PROMPT_SET_VERSION = 1 as const

export interface PlacementListeningAnswer {
  promptId: string
  selectedIndex: number
  dictation: string
  playbackCompleted: boolean
  /** Number of additional plays after the first completed playback. */
  replayCount: number
}

export interface PlacementListeningDiagnostic {
  evidenceVersion: typeof PLACEMENT_LISTENING_EVIDENCE_VERSION
  promptSetVersion: typeof PLACEMENT_LISTENING_PROMPT_SET_VERSION
  answers: PlacementListeningAnswer[]
  completedAt: string
}

export interface PlacementListeningResult {
  comprehension: { correct: number; total: number }
  dictation: { matched: number; total: number; averageWordAccuracy: number }
  byLevel: Record<ListeningPrompt['level'], {
    comprehensionCorrect: number
    dictationMatched: number
    total: number
  }>
}

function editDistance(left: readonly string[], right: readonly string[]): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = left[leftIndex - 1] === right[rightIndex - 1]
        ? previous[rightIndex - 1]
        : Math.min(previous[rightIndex - 1], previous[rightIndex], current[rightIndex - 1]) + 1
    }
    previous = current
  }
  return previous[right.length]
}

export function placementDictationWordAccuracy(response: string, reference: string): number {
  const actual = normalizedListeningWords(response)
  const expected = normalizedListeningWords(reference)
  if (!expected.length) return actual.length ? 0 : 1
  return Math.max(0, 1 - editDistance(actual, expected) / Math.max(actual.length, expected.length))
}

export function isCompletePlacementListeningDiagnostic(
  diagnostic: PlacementListeningDiagnostic,
  prompts: readonly ListeningPrompt[] = PLACEMENT_LISTENING_PROMPTS,
): boolean {
  const completedTime = Date.parse(diagnostic.completedAt)
  if (diagnostic.evidenceVersion !== PLACEMENT_LISTENING_EVIDENCE_VERSION
    || diagnostic.promptSetVersion !== PLACEMENT_LISTENING_PROMPT_SET_VERSION
    || !Number.isFinite(completedTime)
    || new Date(completedTime).toISOString() !== diagnostic.completedAt
    || diagnostic.answers.length !== prompts.length) return false

  const promptsById = new Map(prompts.map((prompt) => [prompt.id, prompt]))
  const answerIds = new Set<string>()
  return diagnostic.answers.every((answer) => {
    const prompt = promptsById.get(answer.promptId)
    if (!prompt || answerIds.has(answer.promptId)) return false
    answerIds.add(answer.promptId)
    return answer.playbackCompleted === true
      && Number.isInteger(answer.selectedIndex)
      && answer.selectedIndex >= 0
      && answer.selectedIndex < prompt.choices.length
      && answer.dictation.trim().length > 0
      && answer.dictation.length <= 2_000
      && Number.isInteger(answer.replayCount)
      && answer.replayCount >= 0
      && answer.replayCount <= 5
  }) && prompts.every((prompt) => answerIds.has(prompt.id))
}

/** Derives the report from raw answers and the immutable versioned prompt set. */
export function derivePlacementListeningResult(
  diagnostic: PlacementListeningDiagnostic,
  prompts: readonly ListeningPrompt[] = PLACEMENT_LISTENING_PROMPTS,
): PlacementListeningResult | null {
  if (!isCompletePlacementListeningDiagnostic(diagnostic, prompts)) return null
  const answers = new Map(diagnostic.answers.map((answer) => [answer.promptId, answer]))
  const byLevel = Object.fromEntries((['A2', 'B1', 'B2', 'C1'] as const).map((level) => [level, {
    comprehensionCorrect: 0,
    dictationMatched: 0,
    total: 0,
  }])) as PlacementListeningResult['byLevel']
  let comprehensionCorrect = 0
  let dictationMatched = 0
  let wordAccuracy = 0

  for (const prompt of prompts) {
    const answer = answers.get(prompt.id)!
    const comprehensionIsCorrect = answer.selectedIndex === prompt.answerIndex
    const dictationIsMatched = dictationMatches(answer.dictation, prompt.text)
    comprehensionCorrect += Number(comprehensionIsCorrect)
    dictationMatched += Number(dictationIsMatched)
    wordAccuracy += placementDictationWordAccuracy(answer.dictation, prompt.text)
    byLevel[prompt.level].comprehensionCorrect += Number(comprehensionIsCorrect)
    byLevel[prompt.level].dictationMatched += Number(dictationIsMatched)
    byLevel[prompt.level].total += 1
  }

  return {
    comprehension: { correct: comprehensionCorrect, total: prompts.length },
    dictation: {
      matched: dictationMatched,
      total: prompts.length,
      averageWordAccuracy: wordAccuracy / prompts.length,
    },
    byLevel,
  }
}
