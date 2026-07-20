import { describe, expect, it } from 'vitest'
import { normalizePhrase } from '../domain/normalization'
import { createSeedData } from './seed'
import { migrateCatalogIdentityProfile, migrateCatalogIdentityTags } from './catalogIdentityMigration'
import { validateForgeData } from './serialization'

const retiredId = 'lex-b1-turn-out'
const replacementId = 'lex-b1-fall-over'

function profileWithCatalogPhrase(canonical: string) {
  const data = createSeedData()
  data.phrases[0] = {
    ...data.phrases[0],
    canonical,
    normalizedKey: normalizePhrase(canonical),
    tags: ['personal', `catalog-item:${retiredId}`],
  }
  return data
}

describe('catalog identity profile migration', () => {
  it('retags only the accidental replacement canonical and preserves the retired meaning', () => {
    const template = createSeedData().phrases[0]
    const accidentalReplacement = {
      ...template,
      id: 'replacement-personal',
      canonical: 'fall over',
      tags: ['personal', 'catalog-item:lex-b1-turn-out'],
    }
    const genuineRetiredMeaning = {
      ...template,
      id: 'retired-personal',
      canonical: 'turn out',
      tags: ['personal', 'catalog-item:lex-b1-turn-out'],
    }
    const editedCard = {
      ...template,
      id: 'edited-personal',
      canonical: 'fall over backwards',
      tags: ['personal', 'catalog-item:lex-b1-turn-out'],
    }

    const [replacement, retired, edited] = migrateCatalogIdentityTags([accidentalReplacement, genuineRetiredMeaning, editedCard])
    expect(replacement.tags).toContain('catalog-item:lex-b1-fall-over')
    expect(replacement.tags).not.toContain('catalog-item:lex-b1-turn-out')
    expect(retired.tags).toContain('catalog-item:lex-b1-turn-out')
    expect(edited.tags).toContain('catalog-item:lex-b1-turn-out')
  })

  it('deduplicates an already-added replacement tag without changing learning fields', () => {
    const phrase = {
      ...createSeedData().phrases[0],
      canonical: 'Single or return?',
      activationStage: 7,
      tags: [
        'catalog-item:lex-a2-one-way-or-return',
        'catalog-item:lex-a2-single-or-return',
      ],
    }
    const [migrated] = migrateCatalogIdentityTags([phrase])
    expect(migrated.tags.filter((tag) => tag === 'catalog-item:lex-a2-single-or-return')).toHaveLength(1)
    expect(migrated.activationStage).toBe(7)
    expect(migrated.id).toBe(phrase.id)
  })

  it('remaps current and historical packs in place while preserving enrollment', () => {
    const data = profileWithCatalogPhrase('fall over')
    data.dailyVocabularyAssignment = {
      dayKey: '2026-07-20',
      level: 'B1',
      itemIds: ['current-before', retiredId, 'current-after'],
      enrolledIds: [retiredId, 'current-after'],
    }
    data.dailyVocabularyAssignments = [{
      dayKey: '2026-07-19',
      level: 'B1',
      itemIds: ['history-before', retiredId, 'history-after'],
      enrolledIds: ['history-before'],
    }]

    const migrated = validateForgeData(data)

    expect(migrated.dailyVocabularyAssignment).toEqual({
      dayKey: '2026-07-20',
      level: 'B1',
      itemIds: ['current-before', replacementId, 'current-after'],
      enrolledIds: [replacementId, 'current-after'],
    })
    expect(migrated.dailyVocabularyAssignments[0]).toEqual({
      dayKey: '2026-07-19',
      level: 'B1',
      itemIds: ['history-before', replacementId, 'history-after'],
      enrolledIds: ['history-before'],
    })
  })

  it('deduplicates a replacement collision in item and enrollment ids', () => {
    const data = profileWithCatalogPhrase('fall over')
    data.dailyVocabularyAssignment = {
      dayKey: '2026-07-20',
      level: 'B1',
      itemIds: ['before', retiredId, replacementId, 'after'],
      enrolledIds: [retiredId, replacementId],
    }

    const migrated = validateForgeData(data)

    expect(migrated.dailyVocabularyAssignment?.itemIds).toEqual(['before', replacementId, 'after'])
    expect(migrated.dailyVocabularyAssignment?.enrolledIds).toEqual([replacementId])
  })

  it('does not remap assignments for a genuine retired canonical', () => {
    const data = profileWithCatalogPhrase('turn out')
    data.dailyVocabularyAssignment = {
      dayKey: '2026-07-20',
      level: 'B1',
      itemIds: ['before', retiredId, 'after'],
      enrolledIds: [retiredId],
    }
    data.dailyVocabularyAssignments = [{
      dayKey: '2026-07-19',
      level: 'B1',
      itemIds: [retiredId, 'history-after'],
      enrolledIds: [],
    }]

    const migrated = migrateCatalogIdentityProfile(data)

    expect(migrated).toBe(data)
    expect(migrated.dailyVocabularyAssignment?.itemIds).toContain(retiredId)
    expect(migrated.dailyVocabularyAssignments[0].itemIds).toContain(retiredId)
  })
})
