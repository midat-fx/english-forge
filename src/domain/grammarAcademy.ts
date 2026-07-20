export const grammarLevels = ['A2', 'B1', 'B2', 'C1'] as const

export type GrammarLevel = (typeof grammarLevels)[number]

export type GrammarCategory =
  | 'tenses'
  | 'questions'
  | 'nouns-and-articles'
  | 'adjectives-and-adverbs'
  | 'modals'
  | 'clauses-and-linking'
  | 'verb-patterns'
  | 'advanced-structures'

export interface GrammarQuizQuestion {
  id: string
  prompt: string
  choices: [string, string, string]
  answerIndex: 0 | 1 | 2
  explanation: string
}

export interface GrammarLesson {
  id: string
  level: GrammarLevel
  category: GrammarCategory
  title: string
  explanation: string
  formula: string
  examples: [string, string, string]
  commonMistake: {
    wrong: string
    correct: string
    note: string
  }
  quiz: [GrammarQuizQuestion, GrammarQuizQuestion, GrammarQuizQuestion]
}

export interface GrammarLessonExperience {
  objective: string
  productionPrompt: string
  masteryCriterion: string
  previousLessonId?: string
  nextLessonId?: string
}

export function lessonsForLevel(lessons: readonly GrammarLesson[], level: GrammarLevel) {
  return lessons.filter((lesson) => lesson.level === level)
}

export function lessonsForCategory(lessons: readonly GrammarLesson[], category: GrammarCategory) {
  return lessons.filter((lesson) => lesson.category === category)
}

export function grammarLexicalCandidates<T extends Pick<Phrase, 'id' | 'cefr' | 'status' | 'activationStage'>>(
  phrases: readonly T[],
  lessonId: string,
  level: GrammarLevel,
): T[] {
  const eligible = phrases
    .filter((phrase) => phrase.cefr === level && (phrase.status === 'active' || phrase.status === 'retained' || (phrase.status === 'learning' && (phrase.activationStage ?? 0) >= 6)))
    .sort((left, right) => left.id.localeCompare(right.id))
  if (eligible.length < 2) return eligible
  const offset = [...lessonId].reduce((hash, character) => (Math.imul(hash, 31) + character.codePointAt(0)!) >>> 0, 7) % eligible.length
  return [...eligible.slice(offset), ...eligible.slice(0, offset)]
}

/**
 * Adds the action-oriented layer shared by every authored lesson without
 * duplicating its explanation or inventing extra answer keys. The lesson's
 * own title, formula and contrast remain the source of truth.
 */
export function grammarLessonExperience(
  lessons: readonly GrammarLesson[],
  lesson: GrammarLesson,
): GrammarLessonExperience {
  const levelLessons = lessons.filter((item) => item.level === lesson.level)
  const index = levelLessons.findIndex((item) => item.id === lesson.id)
  return {
    objective: `После урока вы сможете осознанно выбирать и использовать «${lesson.title}» в собственной короткой реплике.`,
    productionPrompt: `Напишите одно новое предложение по формуле «${lesson.formula}». Используйте личный или рабочий контекст и затем сравните форму с примерами выше.`,
    masteryCriterion: 'Тема отмечается освоенной после двух проверок 3/3 с интервалом не менее 12 часов и новым порядком вариантов, правильно исправленной типичной ошибки, подтверждённого собственного предложения и переноса в новый контекст не раньше чем через 12 часов с отдельным контрольным блоком 3/3 по той же конструкции. Эти подтверждения сохраняются; естественность ваших предложений приложение не оценивает автоматически.',
    previousLessonId: index > 0 ? levelLessons[index - 1]?.id : undefined,
    nextLessonId: index >= 0 && index < levelLessons.length - 1 ? levelLessons[index + 1]?.id : undefined,
  }
}
import type { Phrase } from './types'
