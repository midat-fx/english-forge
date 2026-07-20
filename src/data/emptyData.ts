import type { ForgeData } from '../domain/types'

const defaultPreferences: ForgeData['preferences'] = {
  dailyMinutes: 20,
  maxNewPhrases: 10,
  dailyNewWords: 10,
  englishVariant: 'International',
  explanationLanguage: 'Russian',
  theme: 'light',
  reducedMotion: false,
  keepRecordings: 'forever',
  currentLevel: 'A2',
  targetLevel: 'B1',
}

/** A genuinely blank first-run profile. Demo history is loaded only on demand. */
export function createEmptyData(): ForgeData {
  return structuredClone({
    schemaVersion: 6,
    dailyVocabularyAssignment: null,
    dailyVocabularyAssignments: [],
    phrases: [],
    skillStates: [],
    reviews: [],
    errors: [],
    missions: [],
    speakingAttempts: [],
    listeningClips: [],
    listeningAttempts: [],
    placementAttempts: [],
    grammarProgress: [],
    preferences: defaultPreferences,
  })
}
