import { describe, expect, it } from 'vitest'
import { grammarAcademyLessons } from '../data/grammarAcademy'
import type { ErrorPattern } from './types'
import { grammarLessonForError } from './grammarRecommendation'

describe('error-aware grammar recommendation', () => {
  it('maps a listen-to error to dependent prepositions instead of an unrelated noun lesson', () => {
    const error = {
      category: 'prepositions', label: 'Listen pattern', original: 'I listened him.', correction: 'I listened to him.',
      rule: 'Listen takes to before an object.',
    } as ErrorPattern
    expect(grammarLessonForError(error, grammarAcademyLessons, new Set())?.id).toBe('a2-dependent-prepositions')
  })

  it('does not claim a precise grammar match for a lexical collocation error', () => {
    expect(grammarLessonForError({ category: 'collocation', label: 'make/do' } as ErrorPattern, grammarAcademyLessons, new Set())).toBeUndefined()
  })

  it('maps an explicit day error to time/place and leaves unknown prepositions unclaimed', () => {
    expect(grammarLessonForError({ category: 'prepositions', label: 'in Monday', original: 'in Monday', correction: 'on Monday', rule: 'days take on' } as ErrorPattern, grammarAcademyLessons, new Set())?.id).toBe('a2-prepositions-time-place')
    expect(grammarLessonForError({ category: 'prepositions', label: 'unknown pattern', original: 'x', correction: 'y', rule: 'check it' } as ErrorPattern, grammarAcademyLessons, new Set())).toBeUndefined()
  })
})
