import { activationErrorsB1AuthoredPart1 } from './activationErrorsB1AuthoredPart1'
import { activationErrorsB1AuthoredPart2 } from './activationErrorsB1AuthoredPart2'
import { activationErrorsB1Retained } from './activationErrorsB1Retained'
import { activationErrorsB1Structural } from './activationErrorsB1Structural'

/** Reviewed Step-6 authoring loaded only with the B1 catalog. */
export const activationErrorsB1 = [
  ...activationErrorsB1Retained,
  ...activationErrorsB1Structural,
  ...activationErrorsB1AuthoredPart1,
  ...activationErrorsB1AuthoredPart2,
]
