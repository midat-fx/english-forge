export interface AuthoredActivationErrorPair {
  catalogItemId: string
  incorrectContext: string
  expectedCorrection: string
  cue: string
}

/**
 * A reviewed, item-specific Step-6 repair stored with a personal phrase.
 * Keeping it on the phrase avoids eagerly loading every level's authoring bank.
 */
export type ActivationErrorSpec = Omit<AuthoredActivationErrorPair, 'catalogItemId'>
