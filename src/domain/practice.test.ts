import { describe, expect, it } from 'vitest'
import { createSeedData } from '../data/seed'
import { deriveAcceptedForms } from './normalization'
import { activationErrorResponseMatches, activationRecognitionLabel, buildActivationChoices, buildActivationErrorPrompt, buildPracticePrompt, clozeExpectedAnswer, redactAcceptedForms, responseMatchesPractice } from './practice'

describe('practice prompt integrity', () => {
  const phrase = createSeedData().phrases.find((item) => item.id === 'phrase-fall-short')!

  it('redacts an accepted inflected form from recall and cloze context', () => {
    const recall = buildPracticePrompt(phrase, 'meaning_recall')
    const cloze = buildPracticePrompt(phrase, 'cloze')
    expect(recall.context).toContain('________')
    expect(recall.context.toLowerCase()).not.toContain('fell short of expectations')
    expect(cloze.context.toLowerCase()).not.toContain('fell short of expectations')
  })

  it('does not treat copying the target chunk as productive writing', () => {
    const prompt = buildPracticePrompt(phrase, 'written_productive')
    const preAnswerCopy = Object.values(prompt).join(' ').toLowerCase()
    expect(preAnswerCopy).not.toContain(phrase.canonical.toLowerCase())
    for (const form of phrase.acceptedForms) expect(preAnswerCopy).not.toContain(form.toLowerCase())
    expect(responseMatchesPractice(phrase, 'written_productive', 'fall short of expectations')).toBe(false)
    expect(responseMatchesPractice(phrase, 'written_productive', 'The rushed result may fall short of expectations.')).toBe(true)
  })

  it('builds a real cloze for a variable catalog frame', () => {
    const frame = { ...phrase, canonical: 'be interested in', context: 'I am interested in learning how to cook.', acceptedForms: deriveAcceptedForms('be interested in') }
    const prompt = buildPracticePrompt(frame, 'cloze')
    expect(prompt.context).toContain('________')
    expect(prompt.context).not.toContain('am interested in')
    expect(responseMatchesPractice(frame, 'written_productive', 'My brother is interested in photography.')).toBe(true)
  })

  it('requires the exact authored surface in tense and separable cloze contexts', () => {
    const past = { ...phrase, canonical: 'run out of', acceptedForms: ['ran out of'], context: 'We ran out of coffee before lunch.' }
    expect(clozeExpectedAnswer(past)).toBe('ran out of')
    expect(responseMatchesPractice(past, 'cloze', 'run out of')).toBe(false)
    expect(responseMatchesPractice(past, 'cloze', 'ran out of')).toBe(true)
    const separable = { ...phrase, canonical: 'turn off', acceptedForms: ['turn the oven off'], context: 'Remember to turn the oven off before you leave.' }
    expect(clozeExpectedAnswer(separable)).toBe('turn the oven off')
    expect(responseMatchesPractice(separable, 'cloze', 'turn off')).toBe(false)
    expect(responseMatchesPractice(separable, 'cloze', 'turn the oven off')).toBe(true)
  })

  it('redacts only the lexical noun inside matcher-only plural context', () => {
    const variable = { ...phrase, canonical: 'variable', acceptedForms: ['...pluralcue variables'], context: 'The model controls several variables carefully.' }
    expect(clozeExpectedAnswer(variable)).toBe('variables')
    expect(redactAcceptedForms(variable.context, variable.canonical, variable.acceptedForms)).toBe('The model controls several ________ carefully.')

  })

  it('never certifies a generated structural mutation as a typical usage error', () => {
    const makeDecision = { ...phrase, canonical: 'make a decision', acceptedForms: ['made a decision'], context: 'We made a decision before lunch.' }
    const decisionError = buildActivationErrorPrompt(makeDecision)
    expect(decisionError).toMatchObject({ kind: 'reconstruction', expectedCorrection: 'make a decision' })
    expect(activationErrorResponseMatches(decisionError, makeDecision, 'We made a decision before lunch.')).toBe(true)
    const listenTo = { ...phrase, canonical: 'listen to', acceptedForms: ['listened to'], context: 'We listened to the guide.' }
    expect(buildActivationErrorPrompt(listenTo)).toMatchObject({ kind: 'reconstruction', expectedCorrection: 'listen to' })
    const singleWord = { ...phrase, canonical: 'evidence', acceptedForms: [], context: 'The evidence changed our view.', depth: { ...phrase.depth, contrasts: [] } }
    expect(buildActivationErrorPrompt(singleWord)).toMatchObject({ kind: 'reconstruction', expectedCorrection: 'evidence' })
    const articleChunk = { ...phrase, canonical: 'raise a point', acceptedForms: [], context: 'She tried to raise a point politely.', depth: { ...phrase.depth, contrasts: [] } }
    expect(buildActivationErrorPrompt(articleChunk)).toMatchObject({ kind: 'reconstruction', expectedCorrection: 'raise a point' })
  })

  it('fails closed for transformations that can leave a grammatical sentence with another meaning', () => {
    const cases = [
      { canonical: 'set up', acceptedForms: [], context: 'We set up a weekly call.', wrong: 'We set a weekly call.' },
      { canonical: 'get over', acceptedForms: [], context: 'It took him a week to get over the flu.', wrong: 'It took him a week to get the flu.' },
      { canonical: 'end up', acceptedForms: ['ended up'], context: 'We ended up near the airport.', wrong: 'We ended near the airport.' },
      { canonical: 'reach an agreement', acceptedForms: ['reached an agreement'], context: 'They reached an agreement yesterday.', wrong: 'They reached agreement yesterday.' },
      { canonical: 'prevent ... from', acceptedForms: ['prevented several trains from'], context: 'Snow prevented several trains from leaving.', wrong: 'Snow prevented several trains leaving.' },
      { canonical: 'there is no point in', acceptedForms: ['There is no point in'], context: 'There is no point in arguing.', wrong: 'There is no point arguing.' },
    ]
    for (const item of cases) {
      const candidate = { ...phrase, ...item, depth: { ...phrase.depth, contrasts: [] } }
      expect(buildActivationErrorPrompt(candidate)).toMatchObject({ kind: 'reconstruction', expectedCorrection: item.canonical })
    }
  })

  it('uses attached editorial Step-6 authoring independently of a personal context', () => {
    const editorial = {
      ...phrase,
      canonical: 'reach a decision',
      acceptedForms: ['reached a decision'],
      context: 'My team reached a decision yesterday.',
      activationError: {
        incorrectContext: 'The panel arrived to a decision after lunch.',
        expectedCorrection: 'The panel reached a decision after lunch.',
        cue: 'Используйте коллокацию reach a decision.',
      },
    }
    expect(buildActivationErrorPrompt(editorial)).toMatchObject({
      kind: 'typical',
      context: editorial.activationError.incorrectContext,
      expectedCorrection: editorial.activationError.expectedCorrection,
    })
    expect(buildActivationErrorPrompt({
      ...editorial,
      canonical: 'choose',
      acceptedForms: [],
    }).kind).toBe('reconstruction')
  })

  it('accepts equivalent British and American spellings in an exact repair', () => {
    const prompt = {
      instruction: 'Исправьте предложение', cue: 'Исправьте форму.', context: '', kind: 'typical' as const,
      expectedCorrection: 'The organisation organised a programme about respectful behaviour.',
    }
    expect(activationErrorResponseMatches(prompt, phrase, 'The organization organized a programme about respectful behavior.')).toBe(true)
    expect(activationErrorResponseMatches(prompt, phrase, 'The organization organized a program about respectful behavior')).toBe(true)
    expect(activationErrorResponseMatches(prompt, phrase, 'The organisation organised a programme about respectful behaviour!')).toBe(true)
    expect(activationErrorResponseMatches(prompt, phrase, 'The organization canceled the programme.')).toBe(false)

    const practiceVerbPhrase = { ...phrase, canonical: 'practise speaking', acceptedForms: ['practice speaking'] }
    const b1Prompt = { ...prompt, expectedCorrection: 'Let us practise with a poor-quality recording so that I am prepared.' }
    expect(activationErrorResponseMatches(b1Prompt, practiceVerbPhrase, "Let's practice with a poor quality recording so that I'm prepared")).toBe(true)
    expect(activationErrorResponseMatches({ ...prompt, expectedCorrection: 'I learnt a useful pattern.' }, phrase, 'I learned a useful pattern')).toBe(true)

    const nounPrompt = { ...prompt, expectedCorrection: 'In practice, the rule is hard to apply.' }
    const nounPhrase = { ...phrase, canonical: 'in practice', acceptedForms: [] }
    expect(activationErrorResponseMatches(nounPrompt, nounPhrase, 'In practise, the rule is hard to apply.')).toBe(false)
    expect(activationErrorResponseMatches({ ...prompt, expectedCorrection: 'Unequal promotion practices breed resentment.' }, phrase, 'Unequal promotion practises breed resentment.')).toBe(false)
    expect(activationErrorResponseMatches({ ...prompt, expectedCorrection: 'They emphasized the main risk.' }, phrase, 'They emphasised the main risk.')).toBe(true)
    expect(activationErrorResponseMatches({ ...prompt, expectedCorrection: 'The group mobilized quickly.' }, phrase, 'The group mobilised quickly.')).toBe(true)
    expect(activationErrorResponseMatches({ ...prompt, expectedCorrection: 'The policy marginalized small firms.' }, phrase, 'The policy marginalised small firms.')).toBe(true)
    const expandedPairs = [
      ['The debate increased polarisation.', 'The debate increased polarization.'],
      ['Students must synthesise several sources.', 'Students must synthesize several sources.'],
      ['The organisational culture remains sceptical.', 'The organizational culture remains skeptical.'],
      ['Please summarise the position and minimise disruption.', 'Please summarize the position and minimize disruption.'],
      ['The ageing population challenged a sweeping generalisation.', 'The aging population challenged a sweeping generalization.'],
      ['The finalised report covered five kilometres and neighbouring villages.', 'The finalized report covered five kilometers and neighboring villages.'],
      ['The anonymised records were authorised for review.', 'The anonymized records were authorized for review.'],
    ] as const
    for (const [british, american] of expandedPairs) expect(activationErrorResponseMatches({ ...prompt, expectedCorrection: british }, phrase, american)).toBe(true)

    for (const [britishVerb, americanVerb] of [
      ['I practise English with a classmate.', 'I practice English with a classmate.'],
      ['We practise speaking together once a week.', 'We practice speaking together once a week.'],
      ['I did not want to miss an opportunity to practise with native speakers.', 'I did not want to miss an opportunity to practice with native speakers.'],
      ['For instance, you could practise by describing one photo each day.', 'For instance, you could practice by describing one photo each day.'],
    ] as const) expect(activationErrorResponseMatches({ ...prompt, expectedCorrection: britishVerb }, phrase, americanVerb)).toBe(true)
  })

  it('accepts natural contracted equivalents in an exact repair', () => {
    const typical = (expectedCorrection: string) => ({
      instruction: 'Исправьте предложение', cue: 'Исправьте форму.', context: '', kind: 'typical' as const, expectedCorrection,
    })
    const pairs = [
      ['It was not as difficult as expected.', "It wasn't as difficult as expected."],
      ['The rule does not allow exceptions.', "The rule doesn't allow exceptions."],
      ['I could not remember the address.', "I couldn't remember the address."],
      ['It is worth another attempt.', "It's worth another attempt."],
      ['They are not suitable for this role.', "They aren't suitable for this role."],
      ['I did not want to interrupt.', "I didn't want to interrupt."],
      ['I will go tomorrow.', "I'll go tomorrow."],
      ['There is a medical reason.', "There's a medical reason."],
      ['I have been meaning to call.', "I've been meaning to call."],
      ['He has been meaning to call.', "He's been meaning to call."],
      ['She has been meaning to call.', "She's been meaning to call."],
      ['We have been meaning to call.', "We've been meaning to call."],
      ['They have been meaning to call.', "They've been meaning to call."],
      ['You have been meaning to call.', "You've been meaning to call."],
      ['I had better leave now.', "I'd better leave now."],
      ['She would rather not wait.', "She'd rather not wait."],
      ['We would like to begin.', "We'd like to begin."],
      ['What is more, it is cheaper.', "What's more, it's cheaper."],
      ['It will not fix the underlying issue.', "It won't fix the underlying issue."],
    ] as const
    for (const [expanded, contracted] of pairs) {
      expect(activationErrorResponseMatches(typical(expanded), phrase, contracted)).toBe(true)
      expect(activationErrorResponseMatches(typical(contracted), phrase, expanded)).toBe(true)
    }
  })


  it('builds deterministic, level-aware distractors and redacts each candidate context', () => {
    const sameLevel = { ...phrase, id: 'same', canonical: 'rule out', acceptedForms: [], meaning: 'исключить возможность', context: 'We cannot rule out a delay.', cefr: phrase.cefr, kind: phrase.kind, tags: phrase.tags }
    const otherLevel = { ...phrase, id: 'other', canonical: 'look at', acceptedForms: [], meaning: 'посмотреть', context: 'Please look at this.', cefr: 'A2' as const, tags: [] }
    const choices = buildActivationChoices([phrase, otherLevel, sameLevel], phrase, 'context_choice')
    expect(choices).toEqual(buildActivationChoices([phrase, otherLevel, sameLevel], phrase, 'context_choice'))
    expect(choices.join(' ')).not.toMatch(/fall short|rule out|look at/i)
  })

  it('shows one-language recognition labels and excludes a duplicate catalog card', () => {
    const enrolled = { ...phrase, meaning: 'не оправдать ожиданий · be worse than expected' }
    const sameCatalogCard = { ...phrase, id: 'catalog-copy', meaning: 'не оправдать ожиданий', acceptedForms: [] }
    const distractorOne = { ...phrase, id: 'one', canonical: 'rule out', meaning: 'исключить возможность', context: 'We can rule out a delay.' }
    const distractorTwo = { ...phrase, id: 'two', canonical: 'bear in mind', meaning: 'помнить и учитывать', context: 'Bear this in mind.' }
    const choices = buildActivationChoices([enrolled, sameCatalogCard, distractorOne, distractorTwo], enrolled, 'recognition')
    expect(activationRecognitionLabel(enrolled)).toBe('не оправдать ожиданий')
    expect(choices).toHaveLength(3)
    expect(choices.filter((choice) => choice === 'не оправдать ожиданий')).toHaveLength(1)
    expect(choices.every((choice) => !choice.includes(' · '))).toBe(true)
  })
})
