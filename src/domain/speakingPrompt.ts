import type { GrammarLesson } from './grammarAcademy'
import type { CEFRLevel, GrammarLessonProgress } from './types'

export interface SpeakingGrammarFocus {
  lessonId: string
  title: string
  formula: string
  example: string
}

export function selectSpeakingGrammarFocus(
  lessons: readonly GrammarLesson[],
  progress: readonly GrammarLessonProgress[],
  level: CEFRLevel,
): SpeakingGrammarFocus | undefined {
  const lessonById = new Map(lessons.filter((lesson) => lesson.level === level).map((lesson) => [lesson.id, lesson]))
  const selected = progress
    .filter((item) => lessonById.has(item.lessonId))
    .sort((left, right) => Number(Boolean(left.completedAt)) - Number(Boolean(right.completedAt))
      || left.bestScore / Math.max(1, left.totalQuestions) - right.bestScore / Math.max(1, right.totalQuestions)
      || right.lastAttemptedAt.localeCompare(left.lastAttemptedAt))[0]
  const lesson = selected ? lessonById.get(selected.lessonId) : undefined
  return lesson ? { lessonId: lesson.id, title: lesson.title, formula: lesson.formula, example: lesson.examples[0] } : undefined
}

export function promptWithGrammarFocus(prompt: string, focus: SpeakingGrammarFocus): string {
  const marker = `[Grammar focus ${focus.lessonId}; self-confirmed]`
  return prompt.includes(marker) ? prompt : `${prompt.trim()}\n\n${marker} ${focus.title}. Required pattern: ${focus.formula}`
}

export function stripPersistedGrammarFocus(prompt: string): string {
  return prompt.split(/\n\n\[Grammar focus [^\]]+\]/u)[0].trim()
}
