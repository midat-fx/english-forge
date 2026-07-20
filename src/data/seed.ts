import { initialSkillState } from '../domain/scheduler'
import { activationEvidenceResponseForStage, type ActivationLearningStage } from '../domain/activation'
import { rebuildSkillStates } from '../domain/skillEvidence'
import { normalizePhrase } from '../domain/normalization'
import type { ErrorPattern, ForgeData, Mission, Phrase, ReviewEvent, SkillState } from '../domain/types'
import { createEmptyData } from './emptyData'

export { createEmptyData } from './emptyData'

const now = new Date()
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString()
const ahead = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString()

function phrase(input: Partial<Phrase> & Pick<Phrase, 'id' | 'canonical' | 'meaning' | 'context'>): Phrase {
  return {
    normalizedKey: normalizePhrase(input.canonical),
    kind: 'collocation',
    cefr: 'C1',
    register: ['neutral'],
    source: 'Personal collection',
    tags: [],
    note: '',
    acceptedForms: [],
    examples: [],
    depth: {
      grammarFrame: '',
      collocates: [],
      constraints: [],
      contrasts: [],
      connotation: '',
      pronunciationNote: '',
    },
    status: 'learning',
    createdAt: ago(12),
    updatedAt: ago(1),
    ...input,
  }
}

const phrases: Phrase[] = [
  phrase({
    id: 'phrase-fall-short',
    canonical: 'fall short of expectations',
    meaning: 'fail to reach the standard or result that was hoped for',
    context: 'The final release fell short of expectations despite a promising beta.',
    acceptedForms: ['fell short of expectations', 'falls short of expectations'],
    cefr: 'B2',
    source: 'The Economist — product strategy',
    tags: ['work', 'evaluation'],
    activationError: {
      incorrectContext: 'The final release fell short from expectations despite a promising beta.',
      expectedCorrection: 'The final release fell short of expectations despite a promising beta.',
      cue: 'В выражении fall short of замените неверный предлог from на of.',
    },
    activationStage: 5,
    activationUpdatedAt: ago(2),
    examples: [{ id: 'ex-1', text: 'The proposal falls short of addressing the central risk.' }],
    depth: {
      grammarFrame: 'something falls/fell short of + noun / -ing',
      collocates: ['fall well short', 'fall far short', 'fall short of a target'],
      constraints: ['Usually evaluates a result against an explicit or implied standard.'],
      contrasts: [{ alternative: 'fail', distinction: 'Fail is more direct; fall short foregrounds the gap from a standard.' }],
      connotation: 'Measured but clearly negative; useful in professional evaluation.',
      pronunciationNote: 'Link “short‿of”; the /t/ may be lightly released.',
    },
  }),
  phrase({
    id: 'phrase-bear-in-mind',
    canonical: 'bear in mind',
    meaning: 'remember and consider something when making a decision',
    context: 'Bear in mind that the figures exclude one-off costs.',
    acceptedForms: ['bearing in mind', 'bore in mind'],
    kind: 'idiom',
    cefr: 'B2',
    register: ['neutral', 'formal'],
    source: 'Financial Times — analysis',
    tags: ['work', 'argument'],
    activationError: {
      incorrectContext: 'Bear on mind that the figures exclude one-off costs.',
      expectedCorrection: 'Bear in mind that the figures exclude one-off costs.',
      cue: 'В устойчивом выражении bear in mind используйте предлог in.',
    },
    status: 'learning',
    depth: {
      grammarFrame: 'bear in mind + noun / that-clause',
      collocates: ['do bear in mind', 'important to bear in mind', 'worth bearing in mind'],
      constraints: ['Common in advice; imperative use can sound firm.'],
      contrasts: [{ alternative: 'remember', distinction: 'Bear in mind asks the listener to factor something into a judgment.' }],
      connotation: 'Neutral-to-formal and slightly deliberate.',
      pronunciationNote: 'Primary stress falls on “mind”.',
    },
  }),
  phrase({
    id: 'phrase-call-into-question',
    canonical: 'call into question',
    meaning: 'raise doubts about whether something is true, valid, or reliable',
    context: 'The new evidence may call into question the original conclusion.',
    acceptedForms: ['called into question', 'calls into question'],
    source: 'Research podcast transcript',
    tags: ['academic', 'argument'],
    activationError: {
      incorrectContext: 'The new evidence may call into questions the original conclusion.',
      expectedCorrection: 'The new evidence may call into question the original conclusion.',
      cue: 'В устойчивом выражении call into question слово question остаётся в единственном числе.',
    },
    depth: {
      grammarFrame: 'call + noun + into question',
      collocates: ['call the validity into question', 'seriously call into question'],
      constraints: ['The object is the claim, result, legitimacy, or reliability being doubted.'],
      contrasts: [{ alternative: 'question', distinction: 'Call into question is less abrupt and focuses on evidence creating doubt.' }],
      connotation: 'Formal, analytical, and often diplomatic.',
      pronunciationNote: 'Keep “into” unstressed: /ˈɪntu/ or /ˈɪntə/.',
    },
  }),
  phrase({
    id: 'phrase-with-that-said',
    canonical: 'with that said',
    meaning: 'used to introduce a contrast or qualification',
    context: 'The plan is ambitious. With that said, the team has delivered harder projects.',
    kind: 'discourse_marker',
    cefr: 'B2',
    register: ['neutral', 'spoken'],
    source: 'Interview transcript',
    tags: ['speaking', 'argument'],
    status: 'learning',
    activationError: {
      incorrectContext: 'The plan is ambitious. With that say, the team has delivered harder projects.',
      expectedCorrection: 'The plan is ambitious. With that said, the team has delivered harder projects.',
      cue: 'Use the fixed discourse marker with that said.',
    },
    activationStage: 5,
    activationUpdatedAt: ago(2),
  }),
  phrase({
    id: 'phrase-be-reluctant',
    canonical: 'be reluctant to',
    meaning: 'be unwilling or hesitant to do something',
    context: 'Investors may be reluctant to commit before the audit is complete.',
    acceptedForms: ['was reluctant to', 'were reluctant to', 'is reluctant to', 'are reluctant to'],
    kind: 'grammar_frame',
    cefr: 'B2',
    source: 'Business English notes',
    tags: ['work', 'decision'],
    activationError: {
      incorrectContext: 'Investors may be reluctant committing before the audit is complete.',
      expectedCorrection: 'Investors may be reluctant to commit before the audit is complete.',
      cue: 'После reluctant используйте инфинитив с to.',
    },
    status: 'new',
  }),
  phrase({
    id: 'phrase-to-a-large-extent',
    canonical: 'to a large extent',
    meaning: 'mostly, though not completely',
    context: 'The outcome depends, to a large extent, on how the change is communicated.',
    kind: 'discourse_marker',
    cefr: 'C1',
    register: ['formal', 'academic'],
    source: 'Long-form article',
    tags: ['writing', 'argument'],
    activationError: {
      incorrectContext: 'The outcome depends, in a large extent, on how the change is communicated.',
      expectedCorrection: 'The outcome depends, to a large extent, on how the change is communicated.',
      cue: 'В выражении to a large extent используйте предлог to.',
    },
  }),
  phrase({
    id: 'phrase-rule-out',
    canonical: 'rule out',
    meaning: 'exclude something as impossible or unsuitable',
    context: 'We cannot rule out a short delay while the issue is investigated.',
    acceptedForms: ['ruled out', 'rules out', 'ruling out'],
    kind: 'phrasal_verb',
    cefr: 'B2',
    source: 'Engineering update',
    tags: ['work', 'risk'],
    activationError: {
      incorrectContext: 'We cannot rule off a short delay while the issue is investigated.',
      expectedCorrection: 'We cannot rule out a short delay while the issue is investigated.',
      cue: 'В выражении со значением «исключить возможность» используйте частицу out.',
    },
    status: 'learning',
    activationStage: 5,
    activationUpdatedAt: ago(2),
  }),
  phrase({
    id: 'phrase-little-did',
    canonical: 'little did I know',
    meaning: 'used retrospectively when a later event was unexpected',
    context: 'Little did I know that the short meeting would reshape the entire project.',
    kind: 'grammar_frame',
    cefr: 'C1',
    register: ['spoken'],
    source: 'Storytelling workshop',
    tags: ['storytelling', 'inversion'],
    activationError: {
      incorrectContext: 'Little I did know that the short meeting would reshape the entire project.',
      expectedCorrection: 'Little did I know that the short meeting would reshape the entire project.',
      cue: 'Use auxiliary–subject inversion after little.',
    },
  }),
]

for (const item of phrases.filter((candidate) => candidate.activationStage === 5)) {
  item.activationEvents = ([1, 2, 3, 4, 5] as ActivationLearningStage[]).map((stage) => ({
    stage,
    completedAt: ago(7 - stage),
    evidenceVersion: 1,
    response: activationEvidenceResponseForStage(item, stage),
    ...(stage === 5 ? { selfConfirmed: true } : {}),
  }))
}

const skills: SkillState[] = phrases.flatMap((item, index) => {
  const due = index < 5 ? ago(index % 2) : ahead(index - 4)
  const recall = { ...initialSkillState(item.id, 'meaning_recall', now), phase: index < 4 ? 'review' as const : 'learning' as const, intervalDays: index + 2, dueAt: due, mastery: Math.min(0.82, 0.2 + index * 0.08), attempts: index + 1 }
  const productive = { ...initialSkillState(item.id, 'written_productive', now), dueAt: index < 5 ? ago(0) : ahead(2), mastery: index % 3 === 0 ? 0.45 : 0.12, attempts: index % 3 }
  const spoken = { ...initialSkillState(item.id, 'spoken_productive', now), dueAt: index < 3 ? ago(0) : ahead(1 + index % 3), mastery: 0, attempts: 0 }
  return [recall, productive, spoken]
})

const reviews: ReviewEvent[] = [
  {
    id: 'review-1', idempotencyKey: 'seed-review-1', targetType: 'phrase', targetId: 'phrase-bear-in-mind',
    skill: 'written_productive', exerciseType: 'constrained_sentence', response: 'Bear in mind that this estimate may change.', grade: 2,
    hintsUsed: 0, revealUsed: false, supportUsed: false, reviewedAt: ago(1), dueBefore: ago(1), dueAfter: ahead(4),
  },
  {
    id: 'review-2', idempotencyKey: 'seed-review-2', targetType: 'phrase', targetId: 'phrase-with-that-said',
    skill: 'written_productive', exerciseType: 'constrained_sentence', response: 'With that said, the alternative is still worth considering.', grade: 2,
    hintsUsed: 0, revealUsed: false, supportUsed: false, reviewedAt: ago(0), dueBefore: ago(0), dueAfter: ahead(7),
  },
]

const errors: ErrorPattern[] = [
  {
    id: 'error-depend-on', label: 'Preposition after “depend”', category: 'prepositions',
    original: 'It depends from the context.', correction: 'It depends on the context.',
    hint: 'The verb “depend” takes one specific preposition.', rule: 'Use depend on, never depend from.',
    transferPrompt: 'Rewrite: The result is determined by how quickly the team responds.', occurrences: 4,
    transferAnswer: 'The result depends on how quickly the team responds.',
    status: 'active', dueAt: ago(0), attempts: [], createdAt: ago(18), updatedAt: ago(2),
  },
  {
    id: 'error-suggest-gerund', label: 'Verb form after “suggest”', category: 'tense_aspect',
    original: 'She suggested to postpone the launch.', correction: 'She suggested postponing the launch.',
    hint: 'After “suggest”, use a gerund or a that-clause.', rule: 'Use suggest doing something or suggest that someone do something.',
    transferPrompt: 'Repair: The consultant suggested to review the plan again.', occurrences: 2,
    transferAnswer: 'The consultant suggested reviewing the plan again.',
    status: 'improving', dueAt: ahead(1), attempts: [], createdAt: ago(10), updatedAt: ago(3),
  },
  {
    id: 'error-article-abstract', label: 'Articles with abstract nouns', category: 'articles',
    original: 'The progress requires patience.', correction: 'Progress requires patience.',
    hint: 'Is this abstract noun being used generally or specifically?', rule: 'Omit the article when an uncountable abstract noun is used in a general sense.',
    transferPrompt: 'Repair: The knowledge grows through practice.', occurrences: 3,
    transferAnswer: 'Knowledge grows through practice.',
    status: 'observed', dueAt: ahead(2), attempts: [], createdAt: ago(7), updatedAt: ago(1),
  },
]

const missions: Mission[] = [
  {
    id: 'mission-weekly-brief', level: 'B2', title: 'Decision brief',
    prompt: 'A project delivered mixed results. Write a concise update to leadership: acknowledge the gap, qualify the conclusion, and recommend the next step.',
    targetPhraseIds: ['phrase-fall-short', 'phrase-with-that-said', 'phrase-rule-out'],
    minWords: 120, maxWords: 180, targetPhraseCount: 3,
    supportUsed: false,
    grammarTarget: 'Use one hedged recommendation rather than a direct command.', draft: '',
    targetResults: ['phrase-fall-short', 'phrase-with-that-said', 'phrase-rule-out'].map((phraseId) => ({ phraseId, confirmed: false })),
    status: 'planned', createdAt: ago(1),
  },
]

/** Rich sample data used only after the learner explicitly requests demo mode. */
export function createSeedData(): ForgeData {
  const empty = createEmptyData()
  const data: ForgeData = structuredClone({
    ...empty,
    phrases,
    skillStates: skills,
    reviews,
    errors,
    missions,
    preferences: { ...empty.preferences, currentLevel: 'B2' as const, targetLevel: 'C1' as const },
  })
  return { ...data, skillStates: rebuildSkillStates(data) }
}
