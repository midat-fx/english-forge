import type { GrammarLesson } from './grammarAcademy'
import type { ErrorPattern } from './types'

const CATEGORY_PRIORITIES: Partial<Record<ErrorPattern['category'], readonly string[]>> = {
  prepositions: ['a2-dependent-prepositions', 'a2-prepositions-time-place', 'a2-movement-prepositions', 'b1-phrasal-verb-order'],
  articles: ['a2-articles', 'a2-countable-quantifiers', 'b1-articles-geographical-names'],
  tense_aspect: ['a2-present-simple-v-continuous', 'a2-past-simple', 'a2-present-perfect-basics', 'b1-present-perfect-v-past', 'b1-present-perfect-since-for'],
  word_order: ['a2-question-forms', 'a2-do-or-be-questions', 'b1-embedded-questions', 'b1-phrasal-verb-order'],
}

export function grammarLessonForError(
  error: ErrorPattern | undefined,
  lessons: readonly GrammarLesson[],
  completedLessonIds: ReadonlySet<string>,
): GrammarLesson | undefined {
  if (!error) return undefined
  const text = `${error.label} ${error.rule} ${error.original} ${error.correction}`.toLocaleLowerCase('en-US')
  const contextual = error.category === 'prepositions'
    ? /listen|depend|interested|afraid|good at|responsible/u.test(text)
      ? ['a2-dependent-prepositions']
      : /monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|evening|night|clock|place|address/u.test(text)
        ? ['a2-prepositions-time-place']
        : /towards|through|across|along|movement/u.test(text)
          ? ['a2-movement-prepositions']
          : []
    : error.category === 'word_order' && /particle|phrasal|object position/u.test(text)
      ? ['b1-phrasal-verb-order']
      : error.category === 'tense_aspect' && /present perfect|since|\bfor\b/u.test(text)
        ? ['b1-present-perfect-since-for', 'b1-present-perfect-v-past', 'a2-present-perfect-basics']
        : error.category === 'word_order' ? [] : CATEGORY_PRIORITIES[error.category] ?? []
  return contextual
    .map((id) => lessons.find((lesson) => lesson.id === id && !completedLessonIds.has(id)))
    .find(Boolean)
}
