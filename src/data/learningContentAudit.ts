import { includesPhrase, phraseFingerprint } from '../domain/normalization'
import type { GrammarLesson } from '../domain/grammarAcademy'
import type { LexicalCatalogItem } from '../domain/lexicalCatalog'
import { grammarAcademyLessons } from './grammarAcademy'
import { grammarExplanationRu } from './grammarAcademyRussian'
import { lexicalCatalog } from './lexicalCatalog'
import { catalogAcceptedForms } from './lexicalCatalogSurfaceForms'
import { PLACEMENT_QUESTIONS, type PlacementQuestion, type PlacementSkill } from './placementTest'

export type LearningContentSeverity = 'critical' | 'important' | 'minor'

export interface LearningContentIssue {
  severity: LearningContentSeverity
  code: string
  count: number
  sampleIds: string[]
  detail: string
}

export interface LearningContentAudit {
  lexical: {
    total: number
    byLevel: Record<string, number>
    byKind: Record<string, number>
    byRegister: Record<string, number>
    topicCount: number
    mechanicallyFramedExamples: number
    examplesWithoutFinalPunctuation: number
    patternReviewCandidates: number
  }
  grammar: {
    lessons: number
    questions: number
    byLevel: Record<string, number>
    byCategory: Record<string, number>
    a2B1LessonsWithoutRussianSupport: number
  }
  placement: {
    questions: number
    byLevel: Record<string, number>
    bySkill: Record<string, number>
    answerPositions: number[]
  }
  issues: LearningContentIssue[]
}

const TECHNICAL_FRAGMENT = /(?:\bundefined\b|\bNaN\b|\[object Object\]|\bTODO\b|\bFIXME\b|lorem ipsum|\{\{[^}]*\}\})/iu
const MECHANICAL_EXAMPLE_PREFIX = /^(?:In this situation, it is (?:often helpful|important) to |One useful option is to |You may need to |Without careful planning, we may )/u
const FINAL_PUNCTUATION = /[.!?…][”’']?$/u
const DEPENDENT_PATTERN = /(?:\.{3}|\b(?:depend|rely|focus|insist|result|contribute|refer|respond|object|adapt|apply|belong|cope|engage|participate|specialise|succeed|suffer|recover)\s+(?:to|for|from|on|of|in|at|with|about|into|against|by)|\b(?:look forward|follow up|cut down|run out|catch up|put up)\s+(?:to|for|from|on|of|in|at|with|about)|\bbe\s+(?:aware|capable|interested|responsible|similar|different|good|afraid|used)\s+(?:to|for|from|on|of|in|at|with|about))$/iu

function counts(values: readonly string[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const value of values) result[value] = (result[value] ?? 0) + 1
  return result
}

function choiceKey(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('en-US').trim().replace(/\s+/gu, ' ')
}

function duplicateIds(values: readonly (readonly [id: string, value: string])[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const [id, value] of values) {
    const key = phraseFingerprint(value)
    if (seen.has(key)) duplicates.add(id)
    seen.add(key)
  }
  return [...duplicates]
}

function addIssue(
  issues: LearningContentIssue[],
  severity: LearningContentSeverity,
  code: string,
  ids: readonly string[],
  detail: string,
) {
  if (!ids.length) return
  issues.push({ severity, code, count: ids.length, sampleIds: ids.slice(0, 12), detail })
}

function auditLexical(items: readonly LexicalCatalogItem[], issues: LearningContentIssue[]) {
  const duplicateIdItems = duplicateIds(items.map((item) => [item.id, item.id]))
  const duplicateExpressions = duplicateIds(items.map((item) => [item.id, item.expression]))
  const duplicateExamples = duplicateIds(items.map((item) => [item.id, item.example]))
  const incomplete = items.filter((item) =>
    item.expression.trim().length < 2
    || item.meaningEn.trim().split(/\s+/u).length < 2
    || !/[а-яё]/iu.test(item.translationRu)
    || item.example.trim().split(/\s+/u).length < 6
    || !/[а-яё]/iu.test(item.exampleTranslationRu),
  ).map((item) => item.id)
  const technicalFragments = items.filter((item) =>
    TECHNICAL_FRAGMENT.test([item.expression, item.translationRu, item.meaningEn, item.example, item.exampleTranslationRu, item.pattern, item.note].filter(Boolean).join('\n')),
  ).map((item) => item.id)
  const levelIdMismatch = items.filter((item) => !item.id.startsWith(`lex-${item.level.toLowerCase()}-`)).map((item) => item.id)
  const exampleTargetMismatch = items.filter((item) =>
    !includesPhrase(item.example, item.expression, catalogAcceptedForms(item.expression, item.kind, item.meaningEn, item.id)),
  ).map((item) => item.id)
  const mechanicallyFramed = items.filter((item) => MECHANICAL_EXAMPLE_PREFIX.test(item.example)).map((item) => item.id)
  const patternReviewCandidates = items.filter((item) => !item.pattern && DEPENDENT_PATTERN.test(item.expression.trim())).map((item) => item.id)

  addIssue(issues, 'critical', 'lexical-duplicate-id', duplicateIdItems, 'Stable catalog IDs must be unique.')
  addIssue(issues, 'critical', 'lexical-duplicate-expression', duplicateExpressions, 'User-facing expression fingerprints must be unique across levels.')
  addIssue(issues, 'critical', 'lexical-duplicate-example', duplicateExamples, 'Every active-practice example must be distinct after normalization.')
  addIssue(issues, 'critical', 'lexical-incomplete-card', incomplete, 'Every card needs substantial English/Russian meaning and example fields.')
  addIssue(issues, 'critical', 'lexical-technical-fragment', technicalFragments, 'Learner content must not expose generator or serialization fragments.')
  addIssue(issues, 'critical', 'lexical-level-id-mismatch', levelIdMismatch, 'The stable ID level prefix must match the item level.')
  addIssue(issues, 'critical', 'lexical-example-target-mismatch', exampleTargetMismatch, 'The example must contain an accepted form of the target expression.')
  addIssue(issues, 'important', 'lexical-mechanical-example-family', mechanicallyFramed, 'A small set of generic frames weakens contextual encoding and does not constitute independent editorial review.')
  addIssue(issues, 'important', 'lexical-pattern-metadata-review', patternReviewCandidates, 'Expressions with an open complement or dependent preposition need explicit pattern metadata or documented editorial clearance.')

  return {
    total: items.length,
    byLevel: counts(items.map((item) => item.level)),
    byKind: counts(items.map((item) => item.kind)),
    byRegister: counts(items.map((item) => item.register)),
    topicCount: new Set(items.map((item) => item.topic)).size,
    mechanicallyFramedExamples: mechanicallyFramed.length,
    examplesWithoutFinalPunctuation: items.filter((item) => !FINAL_PUNCTUATION.test(item.example.trim())).length,
    patternReviewCandidates: patternReviewCandidates.length,
  }
}

function auditGrammar(
  lessons: readonly GrammarLesson[],
  russianSupport: Readonly<Record<string, string>>,
  issues: LearningContentIssue[],
) {
  const questions = lessons.flatMap((lesson) => lesson.quiz)
  const duplicateLessonIds = duplicateIds(lessons.map((lesson) => [lesson.id, lesson.id]))
  const duplicateTitles = duplicateIds(lessons.map((lesson) => [lesson.id, lesson.title]))
  const duplicateQuestionIds = duplicateIds(questions.map((question) => [question.id, question.id]))
  const duplicateExamples = duplicateIds(lessons.flatMap((lesson) => lesson.examples.map((example) => [lesson.id, example] as const)))
  const malformedLessons = lessons.filter((lesson) =>
    lesson.title.trim().length < 6
    || lesson.explanation.trim().split(/\s+/u).length < 12
    || lesson.formula.trim().length < 8
    || lesson.examples.length !== 3
    || lesson.quiz.length !== 3
    || lesson.commonMistake.wrong === lesson.commonMistake.correct,
  ).map((lesson) => lesson.id)
  const malformedQuestions = questions.filter((question) =>
    question.choices.length !== 3
    || new Set(question.choices.map(choiceKey)).size !== question.choices.length
    || question.answerIndex < 0
    || question.answerIndex >= question.choices.length
    || !question.explanation.trim(),
  ).map((question) => question.id)
  const missingRussianSupport = lessons.filter((lesson) =>
    (lesson.level === 'A2' || lesson.level === 'B1') && (russianSupport[lesson.id]?.trim().length ?? 0) < 40,
  ).map((lesson) => lesson.id)
  const technicalFragments = lessons.filter((lesson) => TECHNICAL_FRAGMENT.test(JSON.stringify(lesson))).map((lesson) => lesson.id)

  addIssue(issues, 'critical', 'grammar-duplicate-lesson-id', duplicateLessonIds, 'Grammar lesson IDs must be stable and unique.')
  addIssue(issues, 'important', 'grammar-duplicate-title', duplicateTitles, 'Two lessons should not teach the same named target without an explicit contrast.')
  addIssue(issues, 'critical', 'grammar-duplicate-question-id', duplicateQuestionIds, 'Grammar question IDs must be unique.')
  addIssue(issues, 'important', 'grammar-duplicate-example', duplicateExamples, 'Grammar examples should not be recycled across lessons.')
  addIssue(issues, 'critical', 'grammar-malformed-lesson', malformedLessons, 'Every lesson needs a substantial explanation, formula, contrastive error and three examples/questions.')
  addIssue(issues, 'critical', 'grammar-malformed-question', malformedQuestions, 'Each grammar question needs three distinct options, a valid key and feedback.')
  addIssue(issues, 'critical', 'grammar-missing-russian-support', missingRussianSupport, 'Every A2–B1 lesson needs Russian scaffolding.')
  addIssue(issues, 'critical', 'grammar-technical-fragment', technicalFragments, 'Learner-facing grammar must not contain technical artifacts.')

  return {
    lessons: lessons.length,
    questions: questions.length,
    byLevel: counts(lessons.map((lesson) => lesson.level)),
    byCategory: counts(lessons.map((lesson) => lesson.category)),
    a2B1LessonsWithoutRussianSupport: missingRussianSupport.length,
  }
}

function auditPlacement(
  questions: readonly PlacementQuestion[],
  lessonIds: ReadonlySet<string>,
  issues: LearningContentIssue[],
) {
  const duplicateQuestionIds = duplicateIds(questions.map((question) => [question.id, question.id]))
  const malformedQuestions = questions.filter((question) =>
    question.choices.length !== 4
    || new Set(question.choices.map(choiceKey)).size !== question.choices.length
    || question.correctIndex < 0
    || question.correctIndex >= question.choices.length,
  ).map((question) => question.id)
  const brokenLessonLinks = questions.filter((question) => question.lessonId && !lessonIds.has(question.lessonId)).map((question) => question.id)
  const levels = ['A2', 'B1', 'B2', 'C1'] as const
  const skills: PlacementSkill[] = ['grammar', 'vocabulary', 'reading', 'use_of_english']
  const missingAnswerPositions = levels.flatMap((level) => [0, 1, 2, 3]
    .filter((position) => !questions.some((question) => question.level === level && question.correctIndex === position))
    .map((position) => `${level}-${position}`))
  const missingSkillCells = levels.flatMap((level) => skills
    .filter((skill) => !questions.some((question) => question.level === level && question.skill === skill))
    .map((skill) => `${level}-${skill}`))
  const bySkill = counts(questions.map((question) => question.skill))
  const skillCounts = Object.values(bySkill)
  const imbalancedSkills = Math.max(...skillCounts) > Math.min(...skillCounts) * 2 ? questions.map((question) => question.id) : []

  addIssue(issues, 'critical', 'placement-duplicate-id', duplicateQuestionIds, 'Placement item IDs must be unique.')
  addIssue(issues, 'critical', 'placement-malformed-question', malformedQuestions, 'Placement questions need four distinct choices and a valid answer key.')
  addIssue(issues, 'critical', 'placement-broken-lesson-link', brokenLessonLinks, 'Remediation links must resolve to an existing grammar lesson.')
  addIssue(issues, 'important', 'placement-answer-position-gap', missingAnswerPositions, 'A missing answer-key position creates an exploitable response pattern.')
  addIssue(issues, 'important', 'placement-missing-skill-cell', missingSkillCells, 'Each level band must sample every claimed diagnostic skill.')
  addIssue(issues, 'important', 'placement-skill-sampling-imbalance', imbalancedSkills, 'Grammar is sampled more than twice as often as the least-sampled skill; skill-level interpretations are therefore broad only.')

  return {
    questions: questions.length,
    byLevel: counts(questions.map((question) => question.level)),
    bySkill,
    answerPositions: [0, 1, 2, 3].map((position) => questions.filter((question) => question.correctIndex === position).length),
  }
}

export function auditLearningContent(
  items: readonly LexicalCatalogItem[] = lexicalCatalog,
  lessons: readonly GrammarLesson[] = grammarAcademyLessons,
  questions: readonly PlacementQuestion[] = PLACEMENT_QUESTIONS,
  russianSupport: Readonly<Record<string, string>> = grammarExplanationRu,
): LearningContentAudit {
  const issues: LearningContentIssue[] = []
  const lexical = auditLexical(items, issues)
  const grammar = auditGrammar(lessons, russianSupport, issues)
  const placement = auditPlacement(questions, new Set(lessons.map((lesson) => lesson.id)), issues)
  return { lexical, grammar, placement, issues }
}
