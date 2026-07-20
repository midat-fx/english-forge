import { describe, expect, it } from 'vitest'
import { validateForgeData } from './serialization'
import { createEmptyData, createSeedData } from './seed'

describe('profile seeds', () => {
  it('starts a new learner with no fabricated history', () => {
    const profile = validateForgeData(createEmptyData())

    expect(profile.phrases).toEqual([])
    expect(profile.skillStates).toEqual([])
    expect(profile.reviews).toEqual([])
    expect(profile.errors).toEqual([])
    expect(profile.missions).toEqual([])
    expect(profile.placementAttempts).toEqual([])
    expect(profile.preferences.placementCompletedAt).toBeUndefined()
  })

  it('keeps the rich sample profile available only for explicit demo mode', () => {
    const profile = validateForgeData(createSeedData())

    expect(profile.phrases.length).toBeGreaterThan(0)
    expect(profile.reviews.length).toBeGreaterThan(0)
    expect(profile.errors.length).toBeGreaterThan(0)
    expect(profile.preferences.placementCompletedAt).toBeUndefined()
  })
})
