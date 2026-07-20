import type { CEFRLevel } from '../domain/types'

export const PLACEMENT_LEVELS: readonly CEFRLevel[] = ['A2', 'B1', 'B2', 'C1']
export const PLACEMENT_ITEMS_PER_LEVEL = 8

export const PLACEMENT_QUESTION_BLUEPRINT = PLACEMENT_LEVELS.flatMap((level) =>
  Array.from({ length: PLACEMENT_ITEMS_PER_LEVEL }, (_, index) => ({
    id: `${level.toLowerCase()}-${String(index + 1).padStart(2, '0')}`,
    level,
  })),
)

export const PLACEMENT_QUESTION_IDS = PLACEMENT_QUESTION_BLUEPRINT.map((question) => question.id)
export const PLACEMENT_QUESTION_LEVELS = new Map(PLACEMENT_QUESTION_BLUEPRINT.map((question) => [question.id, question.level]))
