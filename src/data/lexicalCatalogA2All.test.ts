import { describe, expect, it } from 'vitest'
import { includesPhrase } from '../domain/normalization'
import { lexicalCatalogA2All } from './lexicalCatalogA2All'
import { catalogAcceptedForms } from './lexicalCatalogSurfaceForms'

const wordCount = (value: string) => value.trim().split(/\s+/u).filter(Boolean).length
const canonicalExpression = (value: string) => value.toLocaleLowerCase('en').replace(/[.?!…]/gu, '').trim()

describe('complete A2 lexical catalog', () => {
  it('contains at least 800 useful learning items', () => {
    expect(lexicalCatalogA2All.length).toBeGreaterThanOrEqual(800)
  })

  it('has no duplicate ids or canonical expressions', () => {
    const ids = lexicalCatalogA2All.map((item) => item.id)
    const expressions = lexicalCatalogA2All.map((item) => canonicalExpression(item.expression))

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(expressions).size).toBe(expressions.length)
  })

  it('has a substantial English example and Russian example translation for every item', () => {
    const shortExamples: string[] = []
    const shortTranslations: string[] = []
    const missingTranslations: string[] = []
    const examples = new Set<string>()
    const duplicateExamples: string[] = []

    for (const item of lexicalCatalogA2All) {
      if (wordCount(item.example) < 6) shortExamples.push(`${item.id}: ${item.example}`)
      if (wordCount(item.exampleTranslationRu) < 4) shortTranslations.push(`${item.id}: ${item.exampleTranslationRu}`)
      if (!/[а-яё]/iu.test(item.exampleTranslationRu)) missingTranslations.push(item.id)
      if (examples.has(item.example)) duplicateExamples.push(`${item.id}: ${item.example}`)
      examples.add(item.example)
    }

    expect(shortExamples).toEqual([])
    expect(shortTranslations).toEqual([])
    expect(missingTranslations).toEqual([])
    expect(duplicateExamples).toEqual([])
  })

  it('keeps every canonical expression usable by the active-practice matcher', () => {
    const failures = lexicalCatalogA2All
      .filter((item) => !includesPhrase(item.example, item.expression, catalogAcceptedForms(item.expression, item.kind, item.meaningEn, item.id)))
      .map((item) => ({ id: item.id, expression: item.expression, example: item.example }))

    expect(failures).toEqual([])
  })

  it('uses a natural Russian prompt for Which one?', () => {
    expect(lexicalCatalogA2All.find((item) => item.expression === 'Which one?')).toMatchObject({
      translationRu: 'который из них?; какая из них?',
      exampleTranslationRu: 'Здесь две двери. Какая из них?',
    })
  })
})
