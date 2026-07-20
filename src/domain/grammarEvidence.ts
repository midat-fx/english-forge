import type { GrammarQuizQuestion } from './grammarAcademy'
import { normalizePhrase } from './normalization'

export const GRAMMAR_EVIDENCE_VERSION = 1 as const

export interface GrammarQuizSelection {
  questionId: string
  selectedIndex: number
}

export function scoreGrammarQuizSelections(
  questions: readonly GrammarQuizQuestion[],
  answers: readonly GrammarQuizSelection[],
): number | undefined {
  if (answers.length !== questions.length || new Set(answers.map((answer) => answer.questionId)).size !== answers.length) return undefined
  const answerById = new Map(answers.map((answer) => [answer.questionId, answer.selectedIndex]))
  if (questions.some((question) => {
    const selected = answerById.get(question.id)
    return !Number.isInteger(selected) || selected! < 0 || selected! >= question.choices.length
  })) return undefined
  return questions.filter((question) => answerById.get(question.id) === question.answerIndex).length
}

export function grammarCorrectionKey(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').replace(/[.!?]+$/u, '').toLocaleLowerCase('en-US')
}

export function grammarCorrectionMatches(response: string, expected: string): boolean {
  return grammarCorrectionKey(response) === grammarCorrectionKey(expected)
}

/** A production check must be a learner-authored sentence, not lesson copy. */
export function grammarDraftIsOriginal(draft: string, lessonReferenceTexts: readonly string[]): boolean {
  const cleaned = draft.trim()
  if (cleaned.split(/\s+/u).length < 6 || cleaned.length > 2_000 || !lessonReferenceTexts.length) return false
  const normalized = normalizePhrase(cleaned)
  return !lessonReferenceTexts.some((example) => normalizePhrase(example) === normalized)
}
