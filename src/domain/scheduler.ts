import type { Grade, Phase, SkillState } from './types'

const MINUTE = 60_000
const DAY = 86_400_000
const LEARNING_DELAYS = [10 * MINUTE, DAY, 3 * DAY]

export const gradeLabels: Record<Grade, string> = {
  0: 'Again',
  1: 'Hard',
  2: 'Good',
  3: 'Easy',
}

export function initialSkillState(phraseId: string, skill: SkillState['skill'], now = new Date()): SkillState {
  return {
    phraseId,
    skill,
    phase: 'new',
    mastery: 0,
    ease: 2,
    intervalDays: 0,
    learningStep: 0,
    dueAt: now.toISOString(),
    attempts: 0,
    firstTrySuccesses: 0,
    lapses: 0,
    consecutiveSuccesses: 0,
    transferPasses: 0,
  }
}

function at(now: Date, delay: number): string {
  return new Date(now.getTime() + delay).toISOString()
}

function nextLearningState(state: SkillState, grade: Grade, now: Date): Pick<SkillState, 'phase' | 'learningStep' | 'intervalDays' | 'dueAt' | 'ease'> {
  if (grade === 0) {
    return { phase: 'learning', learningStep: 0, intervalDays: 0, dueAt: at(now, LEARNING_DELAYS[0]), ease: Math.max(1.3, state.ease - 0.15) }
  }

  if (grade === 1) {
    const delay = state.learningStep === 0 ? LEARNING_DELAYS[0] : DAY
    return { phase: 'learning', learningStep: state.learningStep, intervalDays: delay / DAY, dueAt: at(now, delay), ease: Math.max(1.3, state.ease - 0.05) }
  }

  const jump = grade === 3 ? 2 : 1
  const nextStep = state.learningStep + jump
  if (nextStep >= LEARNING_DELAYS.length) {
    const intervalDays = grade === 3 ? 10 : 7
    return { phase: 'review', learningStep: LEARNING_DELAYS.length, intervalDays, dueAt: at(now, intervalDays * DAY), ease: grade === 3 ? Math.min(2.5, state.ease + 0.05) : state.ease }
  }

  return {
    phase: 'learning',
    learningStep: nextStep,
    intervalDays: LEARNING_DELAYS[nextStep] / DAY,
    dueAt: at(now, LEARNING_DELAYS[nextStep]),
    ease: grade === 3 ? Math.min(2.5, state.ease + 0.05) : state.ease,
  }
}

export function scheduleReview(state: SkillState, grade: Grade, now = new Date()): SkillState {
  const mastery = Number((0.8 * state.mastery + 0.2 * (grade / 3)).toFixed(4))
  const base = {
    ...state,
    mastery,
    attempts: state.attempts + 1,
    lastReviewedAt: now.toISOString(),
    firstTrySuccesses: state.firstTrySuccesses + (grade >= 2 ? 1 : 0),
    consecutiveSuccesses: grade >= 2 ? state.consecutiveSuccesses + 1 : 0,
    lapses: state.lapses + (grade === 0 ? 1 : 0),
  }

  if (grade === 0 && base.lapses >= 5) {
    return { ...base, phase: 'suspended', ease: Math.max(1.3, state.ease - 0.2), intervalDays: 0, learningStep: 0, dueAt: now.toISOString() }
  }

  if (state.phase === 'new' || state.phase === 'learning' || state.phase === 'relearning') {
    return { ...base, ...nextLearningState(state, grade, now) }
  }

  let phase: Phase = 'review'
  let ease = state.ease
  let intervalDays = Math.max(1, state.intervalDays)

  if (grade === 0) {
    phase = 'relearning'
    ease = Math.max(1.3, ease - 0.2)
    intervalDays = Math.max(1, Math.round(intervalDays * 0.25))
    return { ...base, phase, ease, intervalDays, learningStep: 0, dueAt: at(now, LEARNING_DELAYS[0]) }
  }
  if (grade === 1) {
    ease = Math.max(1.3, ease - 0.1)
    intervalDays = Math.max(1, Math.round(intervalDays * 0.5))
  } else if (grade === 2) {
    intervalDays = Math.min(180, Math.max(2, Math.round(intervalDays * ease)))
  } else {
    ease = Math.min(2.5, ease + 0.05)
    intervalDays = Math.min(180, Math.max(4, Math.round(intervalDays * ease * 1.3)))
  }

  return { ...base, phase, ease, intervalDays, dueAt: at(now, intervalDays * DAY) }
}

export function isDue(state: SkillState, now = new Date()): boolean {
  return state.phase !== 'suspended' && new Date(state.dueAt).getTime() <= now.getTime()
}

export function effectiveGrade(requested: Grade, hintsUsed: number, revealUsed: boolean, answerMatched = true): Grade {
  // Revealing the answer is a full retrieval failure: schedule it as Again so the
  // card returns to relearning instead of coasting on a lenient Hard.
  if (revealUsed) return 0
  if (!answerMatched) return 0
  if (hintsUsed > 0) return Math.min(requested, 1) as Grade
  return requested
}
