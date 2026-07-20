import { phraseFingerprint } from '../domain/normalization'
import type { DailyVocabularyAssignment, ForgeData, Phrase } from '../domain/types'
import { CATALOG_IDENTITY_MIGRATIONS } from './lexicalCatalogIdentityHistory'

type CatalogIdentityEvidence = Pick<Phrase, 'canonical' | 'tags'>

function provenAssignmentReplacements(phrases: readonly CatalogIdentityEvidence[]): Map<string, string> {
  const replacements = new Map<string, string>()
  for (const [retiredId, , replacementId, replacementExpression] of CATALOG_IDENTITY_MIGRATIONS) {
    const retiredTag = `catalog-item:${retiredId}`
    const replacementFingerprint = phraseFingerprint(replacementExpression)
    if (phrases.some((phrase) => phrase.tags.includes(retiredTag)
      && phraseFingerprint(phrase.canonical) === replacementFingerprint)) {
      replacements.set(retiredId, replacementId)
    }
  }
  return replacements
}

function migrateAssignmentIds(ids: string[], replacements: ReadonlyMap<string, string>): string[] {
  let changed = false
  const seen = new Set<string>()
  const migrated: string[] = []
  for (const id of ids) {
    const nextId = replacements.get(id) ?? id
    if (nextId !== id || seen.has(nextId)) changed = true
    if (seen.has(nextId)) continue
    seen.add(nextId)
    migrated.push(nextId)
  }
  return changed ? migrated : ids
}

function migrateAssignment(
  assignment: DailyVocabularyAssignment,
  replacements: ReadonlyMap<string, string>,
): DailyVocabularyAssignment {
  const itemIds = migrateAssignmentIds(assignment.itemIds, replacements)
  const enrolledIds = migrateAssignmentIds(assignment.enrolledIds, replacements)
  return itemIds === assignment.itemIds && enrolledIds === assignment.enrolledIds
    ? assignment
    : { ...assignment, itemIds, enrolledIds }
}

/**
 * Repairs only profiles created during the accidental semantic-ID reuse.
 * A retired tag is changed when the canonical fingerprint proves that the
 * personal card contains the replacement target. Genuine cards for the old
 * expression keep the old tag and all of their evidence.
 */
export function migrateCatalogIdentityTags(phrases: readonly Phrase[]): Phrase[] {
  let changed = false
  const migrated = phrases.map((phrase) => {
    let nextTags = phrase.tags
    for (const [retiredId, , replacementId, replacementExpression] of CATALOG_IDENTITY_MIGRATIONS) {
      const retiredTag = `catalog-item:${retiredId}`
      if (!nextTags.includes(retiredTag)
        || phraseFingerprint(phrase.canonical) !== phraseFingerprint(replacementExpression)) continue
      const replacementTag = `catalog-item:${replacementId}`
      nextTags = [...new Set(nextTags.map((tag) => tag === retiredTag ? replacementTag : tag))]
    }
    if (nextTags === phrase.tags) return phrase
    changed = true
    return { ...phrase, tags: nextTags }
  })
  return changed ? migrated : phrases as Phrase[]
}

/**
 * Migrates assignment references only when a personal phrase proves that the
 * retired catalog ID was used for its replacement expression. Assignment order
 * and enrollment are preserved; an existing replacement ID is deduplicated.
 */
export function migrateCatalogIdentityProfile(data: ForgeData): ForgeData {
  const replacements = provenAssignmentReplacements(data.phrases)
  const phrases = migrateCatalogIdentityTags(data.phrases)
  if (replacements.size === 0) return phrases === data.phrases ? data : { ...data, phrases }

  const dailyVocabularyAssignment = data.dailyVocabularyAssignment
    ? migrateAssignment(data.dailyVocabularyAssignment, replacements)
    : null
  let assignmentsChanged = false
  const dailyVocabularyAssignments = data.dailyVocabularyAssignments.map((assignment) => {
    const migrated = migrateAssignment(assignment, replacements)
    if (migrated !== assignment) assignmentsChanged = true
    return migrated
  })

  if (phrases === data.phrases
    && dailyVocabularyAssignment === data.dailyVocabularyAssignment
    && !assignmentsChanged) return data
  return {
    ...data,
    phrases,
    dailyVocabularyAssignment,
    dailyVocabularyAssignments: assignmentsChanged
      ? dailyVocabularyAssignments
      : data.dailyVocabularyAssignments,
  }
}
