import type { GrammarLesson, GrammarQuizQuestion, GrammarLevel } from '../domain/grammarAcademy'
import type { GrammarLessonProgress } from '../domain/types'
import { grammarQuizForAttempt } from './grammarAcademy'

export interface GrammarCheckpointItem {
  lessonId: string
  lessonTitle: string
  question: GrammarQuizQuestion
}

const DAY_MS = 24 * 60 * 60 * 1000

function stableHash(value: string): number {
  return [...value].reduce((hash, character) => (Math.imul(hash, 37) + character.codePointAt(0)!) >>> 0, 19)
}

export function grammarCheckpointDueAt(progress: GrammarLessonProgress): number {
  if (progress.nextCumulativeDueAt) return new Date(progress.nextCumulativeDueAt).getTime()
  const anchor = progress.completedAt ?? progress.lastAttemptedAt
  return new Date(anchor).getTime() + (progress.completedAt ? 7 : 1) * DAY_MS
}

export function dueGrammarLessonIds(
  lessons: readonly GrammarLesson[],
  progress: readonly GrammarLessonProgress[],
  level: GrammarLevel,
  now = new Date(),
): string[] {
  const progressByLesson = new Map(progress.map((item) => [item.lessonId, item]))
  return lessons
    .filter((lesson) => lesson.level === level && progressByLesson.has(lesson.id))
    .map((lesson) => ({ lesson, progress: progressByLesson.get(lesson.id)! }))
    .filter(({ progress: item }) => grammarCheckpointDueAt(item) <= now.getTime())
    .sort((left, right) => grammarCheckpointDueAt(left.progress) - grammarCheckpointDueAt(right.progress)
      || left.progress.bestScore / left.progress.totalQuestions - right.progress.bestScore / right.progress.totalQuestions
      || left.lesson.id.localeCompare(right.lesson.id))
    .map(({ lesson }) => lesson.id)
}

export function buildGrammarCheckpoint(
  lessons: readonly GrammarLesson[],
  progress: readonly GrammarLessonProgress[],
  level: GrammarLevel,
  now = new Date(),
  limit = 5,
): GrammarCheckpointItem[] {
  const progressByLesson = new Map(progress.map((item) => [item.lessonId, item]))
  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]))
  const candidates = dueGrammarLessonIds(lessons, progress, level, now)
    .map((lessonId) => ({ lesson: lessonById.get(lessonId)!, progress: progressByLesson.get(lessonId)! }))
    .slice(0, Math.max(2, Math.min(8, limit)))
  if (!candidates.length) return []
  return candidates.map(({ lesson, progress: item }) => {
    const quiz = grammarQuizForAttempt(lesson, item.cumulativeAttempts ?? 0)
    const question = quiz[stableHash(`${lesson.id}:${item.cumulativeAttempts ?? 0}`) % quiz.length]
    return { lessonId: lesson.id, lessonTitle: lesson.title, question }
  })
}

export function nextGrammarCheckpointAt(progress: readonly GrammarLessonProgress[], levelLessonIds: ReadonlySet<string>): number | undefined {
  const dueDates = progress.filter((item) => levelLessonIds.has(item.lessonId)).map(grammarCheckpointDueAt).filter(Number.isFinite)
  return dueDates.length ? Math.min(...dueDates) : undefined
}
