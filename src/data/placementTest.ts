import type { CEFRLevel, PlacementAnswer } from '../domain/types'

export type PlacementSkill = 'grammar' | 'vocabulary' | 'reading' | 'use_of_english'
export const PLACEMENT_QUESTION_SET_VERSION = 1 as const

export interface PlacementQuestion {
  id: string
  level: CEFRLevel
  skill: PlacementSkill
  prompt: string
  context?: string
  choices: string[]
  correctIndex: number
  explanation: string
  lessonId?: string
}

export const PLACEMENT_SOURCES = [
  { label: 'Council of Europe — CEFR Companion Volume', url: 'https://rm.coe.int/cefr-companion-volume-with-new-descriptors-2020/16809ea0d4' },
  { label: 'Council of Europe — searchable CEFR descriptors', url: 'https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors-search' },
  { label: 'Cambridge English — A2 Key', url: 'https://www.cambridgeenglish.org/exams-and-tests/qualifications/key/' },
  { label: 'Cambridge English — B1 Preliminary format', url: 'https://www.cambridgeenglish.org/exams-and-tests/preliminary/exam-format/' },
  { label: 'British Council — approximate level test guidance', url: 'https://learnenglish.britishcouncil.org/level' },
] as const

export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  { id: 'a2-01', level: 'A2', skill: 'grammar', prompt: 'My brother ___ coffee every morning.', choices: ['drink', 'drinks', 'is drink', 'drinking'], correctIndex: 1, explanation: 'В Present Simple после he/she/it обычно добавляется -s: he drinks.', lessonId: 'a2-present-simple' },
  { id: 'a2-02', level: 'A2', skill: 'grammar', prompt: 'We ___ to the cinema last Saturday.', choices: ['go', 'have gone', 'went', 'were go'], correctIndex: 2, explanation: 'Указание на завершённый момент в прошлом — last Saturday — требует Past Simple: went.', lessonId: 'a2-past-simple' },
  { id: 'a2-03', level: 'A2', skill: 'reading', prompt: 'What does Ben need to buy?', context: 'Ben opens the fridge before breakfast. There are eggs and some juice, but there isn’t any milk left.', choices: ['Eggs', 'Juice', 'Breakfast', 'Milk'], correctIndex: 3, explanation: 'В тексте сказано, что молока не осталось, значит, Бену нужно купить milk.' },
  { id: 'a2-04', level: 'A2', skill: 'use_of_english', prompt: 'Complete the sentence naturally: This route is ___ than the motorway.', choices: ['shorter', 'more short', 'shortest', 'the shorter'], correctIndex: 0, explanation: 'Короткие прилагательные образуют сравнительную степень с -er: shorter.', lessonId: 'a2-comparatives-superlatives' },
  { id: 'a2-05', level: 'A2', skill: 'vocabulary', prompt: 'Can I ___ your pen for a minute?', choices: ['borrow', 'lend', 'bring', 'carry'], correctIndex: 0, explanation: 'Borrow значит взять у кого-то на время; lend — дать кому-то на время.' },
  { id: 'a2-06', level: 'A2', skill: 'vocabulary', prompt: 'I usually ___ at seven and make breakfast.', choices: ['get on', 'look up', 'take off', 'get up'], correctIndex: 3, explanation: 'Get up — вставать с постели.' },
  { id: 'a2-07', level: 'A2', skill: 'reading', prompt: 'What should Maya do?', context: 'Maya, the meeting is now in Room 12, not Room 8. Please bring the sales notes. — Leo', choices: ['Go to Room 8', 'Bring the notes to Room 12', 'Cancel the meeting', 'Send the notes to Leo'], correctIndex: 1, explanation: 'Сообщение меняет комнату и просит принести записи.' },
  { id: 'a2-08', level: 'A2', skill: 'use_of_english', prompt: 'Choose the natural sentence.', choices: ['I am interested on photography.', 'I interested in photography.', 'I am interested in photography.', 'I am interesting in photography.'], correctIndex: 2, explanation: 'Правильная модель: be interested in + noun/-ing.', lessonId: 'a2-dependent-prepositions' },

  { id: 'b1-01', level: 'B1', skill: 'grammar', prompt: 'I ___ this laptop for three years, and it still works well.', choices: ['have had', 'had', 'am having', 'have'], correctIndex: 0, explanation: 'Действие началось раньше и продолжается сейчас: Present Perfect + for.', lessonId: 'b1-present-perfect-since-for' },
  { id: 'b1-02', level: 'B1', skill: 'grammar', prompt: 'If the weather ___ better tomorrow, we’ll go hiking.', choices: ['will get', 'got', 'would get', 'gets'], correctIndex: 3, explanation: 'В first conditional после if используется Present Simple.', lessonId: 'b1-zero-first-second-conditionals' },
  { id: 'b1-03', level: 'B1', skill: 'reading', prompt: 'What changed after the writer started the new job?', context: 'Until last year, I played tennis every week. Since starting my new job, I have rarely had enough free time for it.', choices: ['The writer began playing tennis more often.', 'The writer now has little time for tennis.', 'The writer decided not to take the new job.', 'The tennis club changed its opening hours.'], correctIndex: 1, explanation: 'Второе предложение говорит, что после начала новой работы у автора редко хватает времени на теннис.' },
  { id: 'b1-04', level: 'B1', skill: 'use_of_english', prompt: 'Complete the report: The new bridge ___ in 2019.', choices: ['built', 'has built', 'was built', 'was building'], correctIndex: 2, explanation: 'Объект получил действие в прошлом: Past Simple Passive — was built.', lessonId: 'b1-passive-basics' },
  { id: 'b1-05', level: 'B1', skill: 'vocabulary', prompt: 'We need to ___ a decision before Friday.', choices: ['make', 'do', 'take up', 'create up'], correctIndex: 0, explanation: 'Устойчивая коллокация: make a decision.' },
  { id: 'b1-06', level: 'B1', skill: 'vocabulary', prompt: 'We had to ___ the meeting until Friday because two people were ill.', choices: ['turn out', 'take after', 'give away', 'put off'], correctIndex: 3, explanation: 'Put off означает перенести или отложить событие.' },
  { id: 'b1-07', level: 'B1', skill: 'reading', prompt: 'Why did Noah change his travel plan?', context: 'Noah planned to take the early train because it was cheaper. When he learned that the station would be closed until 9 a.m., he booked a coach instead.', choices: ['The coach was cheaper', 'He woke up late', 'The train station would not be open', 'The train was fully booked'], correctIndex: 2, explanation: 'Причина прямо указана: станция будет закрыта до девяти.' },
  { id: 'b1-08', level: 'B1', skill: 'use_of_english', prompt: '___ being tired, she finished the report.', choices: ['Although', 'Despite', 'Because', 'However'], correctIndex: 1, explanation: 'Despite ставится перед существительным или -ing формой: despite being tired.', lessonId: 'b1-contrast-linkers' },

  { id: 'b2-01', level: 'B2', skill: 'grammar', prompt: 'If I ___ about the roadworks, I would have left earlier.', choices: ['knew', 'had known', 'would know', 'have known'], correctIndex: 1, explanation: 'Third conditional: if + Past Perfect, would have + V3.', lessonId: 'b2-third-mixed-conditionals' },
  { id: 'b2-02', level: 'B2', skill: 'grammar', prompt: 'On Monday she said, “By Friday, I will have finished the report.” Report this: She said that by the following Friday she ___ the report.', choices: ['had finished', 'will have finished', 'would finish', 'would have finished'], correctIndex: 3, explanation: 'Future Perfect из прямой речи при backshift становится future perfect in the past: would have finished.', lessonId: 'b2-future-in-the-past' },
  { id: 'b2-03', level: 'B2', skill: 'reading', prompt: 'What is the most likely explanation for the scene?', context: 'The office is empty. Everyone’s coats and bags have gone, although several lights are still on and a half-finished note lies on the desk.', choices: ['The staff finished calmly and left at the usual time.', 'The staff left suddenly before all their work was finished.', 'The staff have not arrived for work yet.', 'The company has moved to another office permanently.'], correctIndex: 1, explanation: 'Включённый свет и незаконченная записка на фоне исчезнувших вещей поддерживают вывод о внезапном уходе.' },
  { id: 'b2-04', level: 'B2', skill: 'use_of_english', prompt: 'Complete the sentence naturally: I regret ___ him about the change sooner.', choices: ['not telling', 'not to tell', 'to not telling', 'not tell'], correctIndex: 0, explanation: 'Regret + -ing относится к сожалению о прошлом действии.', lessonId: 'b2-verb-pattern-meaning' },
  { id: 'b2-05', level: 'B2', skill: 'vocabulary', prompt: 'The new evidence ___ doubt on the original conclusion.', choices: ['drops', 'puts', 'casts', 'makes'], correctIndex: 2, explanation: 'Устойчивая формальная коллокация: cast doubt on.' },
  { id: 'b2-06', level: 'B2', skill: 'vocabulary', prompt: 'The company plans to ___ the outdated procedure gradually.', choices: ['phase out', 'put through', 'bring off', 'take after'], correctIndex: 0, explanation: 'Phase out — постепенно прекратить использование.' },
  { id: 'b2-07', level: 'B2', skill: 'reading', prompt: 'What is the writer’s main reservation?', context: 'Remote work has reduced commuting and widened recruitment. Even so, teams that rely on spontaneous discussion may need deliberate ways to replace the informal exchanges once provided by a shared office.', choices: ['Remote work should end', 'Recruitment has become harder', 'Informal collaboration may need active support', 'Commuting is useful for teams'], correctIndex: 2, explanation: 'Автор признаёт преимущества, но предупреждает о потере неформального взаимодействия.' },
  { id: 'b2-08', level: 'B2', skill: 'use_of_english', prompt: '___ a shortage of components, the team completed the launch on schedule.', choices: ['Although', 'Because of', 'In spite', 'Despite'], correctIndex: 3, explanation: 'Despite ставится перед именной группой и вводит уступку: despite a shortage.', lessonId: 'b1-contrast-linkers' },

  { id: 'c1-01', level: 'C1', skill: 'grammar', prompt: 'Rarely ___ such a convincing explanation.', choices: ['I have heard', 'have I heard', 'I heard have', 'did I have heard'], correctIndex: 1, explanation: 'После ограничительного наречия в начале предложения используется инверсия.', lessonId: 'c1-negative-adverbial-inversion' },
  { id: 'c1-02', level: 'C1', skill: 'grammar', prompt: 'What I find most useful ___ the way the report separates fact from opinion.', choices: ['are', 'have been', 'is', 'being'], correctIndex: 2, explanation: 'В cleft-конструкции What I find ... выступает единым подлежащим: is.', lessonId: 'c1-cleft-sentences' },
  { id: 'c1-03', level: 'C1', skill: 'reading', prompt: 'What can be inferred about Elena’s present situation?', context: 'Last year, Elena declined a role in Berlin and stayed in Madrid. The Berlin position was permanent, so accepting it would have changed where she lives today.', choices: ['She divides her time equally between Berlin and Madrid.', 'Her decision probably means that she still lives in Madrid.', 'She had already lived in Berlin before declining the role.', 'She expects the Berlin role to become temporary.'], correctIndex: 1, explanation: 'Она отказалась от постоянной работы в Берлине и осталась в Мадриде, поэтому текст поддерживает вывод, что она по-прежнему живёт в Мадриде.' },
  { id: 'c1-04', level: 'C1', skill: 'use_of_english', prompt: 'Complete the formal recommendation: The committee recommended that the proposal ___ revised.', choices: ['is', 'was', 'be', 'will be'], correctIndex: 2, explanation: 'После formal recommend that возможен subjunctive: базовая форма be.', lessonId: 'c1-mandative-subjunctive' },
  { id: 'c1-05', level: 'C1', skill: 'vocabulary', prompt: 'The minister tried to ___ concerns about the cost by publishing the full budget.', choices: ['allay', 'delete', 'decline', 'prevent out'], correctIndex: 0, explanation: 'Allay concerns/fears означает уменьшить беспокойство.' },
  { id: 'c1-06', level: 'C1', skill: 'vocabulary', prompt: 'Her conclusion is plausible, but the evidence is too ___ to be decisive.', choices: ['conclusive', 'inevitable', 'flawless', 'equivocal'], correctIndex: 3, explanation: 'Equivocal означает неоднозначный, допускающий разные толкования; такой материал не позволяет сделать уверенный вывод.' },
  { id: 'c1-07', level: 'C1', skill: 'reading', prompt: 'Which position best matches the writer’s view?', context: 'Efficiency is often treated as an unquestionable good. Yet a system with no spare capacity can fail dramatically when conditions change. A small amount of apparent redundancy may therefore be the price of genuine resilience.', choices: ['Resilience may require some spare capacity', 'Efficiency is never useful', 'Unused capacity is always wasteful', 'Conditions rarely change'], correctIndex: 0, explanation: 'Автор оспаривает абсолютную эффективность и защищает резерв ради устойчивости.' },
  { id: 'c1-08', level: 'C1', skill: 'use_of_english', prompt: 'The evidence is preliminary. Choose the claim whose degree of certainty fits it best.', choices: ['The findings clearly establish a limitation in the policy.', 'The findings may prove that the policy must fail.', 'The findings demonstrate the policy’s failure beyond doubt.', 'The findings appear to suggest a possible limitation in the policy.'], correctIndex: 3, explanation: 'Appear to suggest и possible согласуют осторожность формулировки с предварительным характером данных.', lessonId: 'c1-hedging-claims' },
]

const LEVELS: CEFRLevel[] = ['A2', 'B1', 'B2', 'C1']

export interface PlacementResult {
  score: number
  maxScore: number
  suggestedLevel: CEFRLevel
  bandScores: Record<CEFRLevel, { correct: number; total: number }>
  weakestSkill?: PlacementSkill
  skillScores: Record<PlacementSkill, { correct: number; total: number; rate: number }>
  foundationReview: boolean
  diagnosticConfidence: 'low' | 'moderate'
  limitations: string[]
}

export function scorePlacement(selected: Record<string, number>): PlacementResult {
  const answers = PLACEMENT_QUESTIONS.filter((question) => selected[question.id] !== undefined)
  const bandScores = Object.fromEntries(LEVELS.map((level) => {
    const questions = PLACEMENT_QUESTIONS.filter((question) => question.level === level)
    return [level, { correct: questions.filter((question) => selected[question.id] === question.correctIndex).length, total: questions.length }]
  })) as PlacementResult['bandScores']
  let suggestedLevel: CEFRLevel = 'A2'
  const hasA2Foundation = bandScores.A2.correct >= 5
  const passedB2 = bandScores.B2.correct >= 6
  const passedC1 = bandScores.C1.correct >= 6
  // Monotonic ladder: once the A2 foundation and half the B1 band are in place the
  // recommendation is at least B1, so raising any higher band can never lower the level.
  if (hasA2Foundation && bandScores.B1.correct >= 5) suggestedLevel = 'B1'
  if (hasA2Foundation && bandScores.B1.correct >= 5 && passedB2) suggestedLevel = 'B2'
  if (hasA2Foundation && bandScores.B1.correct >= 5 && passedB2 && passedC1) suggestedLevel = 'C1'
  const skills: PlacementSkill[] = ['grammar', 'vocabulary', 'reading', 'use_of_english']
  const skillScores = Object.fromEntries(skills.map((skill) => {
    const skillItems = PLACEMENT_QUESTIONS.filter((question) => question.skill === skill)
    const correct = skillItems.filter((question) => selected[question.id] === question.correctIndex).length
    return [skill, { correct, total: skillItems.length, rate: skillItems.length ? correct / skillItems.length : 0 }]
  })) as PlacementResult['skillScores']
  const minimumRate = Math.min(...skills.map((skill) => skillScores[skill].rate))
  const weakest = skills.filter((skill) => skillScores[skill].rate === minimumRate)
  const weakestSkill = weakest.length === 1 ? weakest[0] : undefined
  const complete = answers.length === PLACEMENT_QUESTIONS.length
  const diagnosticConfidence = complete && bandScores[suggestedLevel].correct >= 7 ? 'moderate' : 'low'
  return {
    score: answers.filter((question) => selected[question.id] === question.correctIndex).length,
    maxScore: PLACEMENT_QUESTIONS.length,
    suggestedLevel,
    bandScores,
    weakestSkill,
    skillScores,
    foundationReview: bandScores.A2.correct < 5,
    diagnosticConfidence,
    limitations: [
      'This short diagnostic samples reading and language knowledge; it does not test listening, speaking or writing.',
      'The CEFR result is a provisional learning recommendation, not a certificate or an official exam score.',
    ],
  }
}

export function isCompletePlacementSelection(selected: Record<string, number>): boolean {
  const expectedIds = new Set(PLACEMENT_QUESTIONS.map((question) => question.id))
  const actualIds = Object.keys(selected)
  return actualIds.length === expectedIds.size && actualIds.every((id) => expectedIds.has(id)) && PLACEMENT_QUESTIONS.every((question) => Number.isInteger(selected[question.id]) && selected[question.id] >= 0 && selected[question.id] < question.choices.length)
}

/**
 * Rebuilds a complete current-question-set selection from the raw answers kept
 * with a saved placement attempt. Callers must still check the attempt's
 * questionSetVersion before interpreting the selection with the current key.
 */
export function placementSelectionFromAnswers(
  answers: readonly Pick<PlacementAnswer, 'questionId' | 'selectedIndex'>[],
): Record<string, number> | undefined {
  const selected: Record<string, number> = {}
  for (const answer of answers) {
    if (Object.prototype.hasOwnProperty.call(selected, answer.questionId)) return undefined
    selected[answer.questionId] = answer.selectedIndex
  }
  return isCompletePlacementSelection(selected) ? selected : undefined
}

export function recommendedPlacementLessonIds(selected: Record<string, number>, maximumLevel = scorePlacement(selected).suggestedLevel): string[] {
  const levelIndex = LEVELS.indexOf(maximumLevel)
  return [...new Set(PLACEMENT_QUESTIONS
    .filter((question) => question.lessonId && LEVELS.indexOf(question.level) <= levelIndex && selected[question.id] !== question.correctIndex)
    .map((question) => question.lessonId!))]
}

/**
 * Rebuilds remediation from the immutable correctness recorded with an
 * attempt. This deliberately avoids applying a newer answer key to legacy
 * attempts when the placement question set changes.
 */
export function recommendedPlacementLessonIdsFromAnswers(
  answers: readonly Pick<PlacementAnswer, 'questionId' | 'correct'>[],
  maximumLevel: CEFRLevel,
): string[] {
  const levelIndex = LEVELS.indexOf(maximumLevel)
  const correctnessById = new Map(answers.map((answer) => [answer.questionId, answer.correct]))
  return [...new Set(PLACEMENT_QUESTIONS
    .filter((question) => question.lessonId
      && LEVELS.indexOf(question.level) <= levelIndex
      && correctnessById.get(question.id) === false)
    .map((question) => question.lessonId!))]
}

export function placementAnswers(selected: Record<string, number>): PlacementAnswer[] {
  return PLACEMENT_QUESTIONS.map((question) => ({
    questionId: question.id,
    selectedIndex: selected[question.id],
    correct: selected[question.id] === question.correctIndex,
  }))
}
