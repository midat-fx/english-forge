import { describe, expect, it } from 'vitest'
import { deriveAcceptedForms, includesPhrase, normalizePhrase, phraseFingerprint, phraseSearchRegExp } from './normalization'

describe('phrase normalization', () => {
  it('normalizes smart apostrophes, unicode and repeated spaces', () => {
    expect(normalizePhrase('  Don’t   rule  it out  ')).toBe("don't rule it out")
  })

  it('creates equal fingerprints for punctuation and spacing variants', () => {
    expect(phraseFingerprint('On  the other hand…')).toBe(phraseFingerprint('on the other hand'))
  })

  it('matches a complete phrase inside a sentence', () => {
    expect(includesPhrase('We cannot rule out a delay.', 'rule out')).toBe(true)
  })

  it('accepts explicitly authored inflected aliases', () => {
    expect(includesPhrase('The result fell short of expectations.', 'fall short of expectations', ['fell short of expectations'])).toBe(true)
  })

  it('does not match inside a larger word', () => {
    expect(includesPhrase('The accountant arrived.', 'account')).toBe(false)
  })

  it('matches inflected catalog forms and slot-based patterns', () => {
    expect(includesPhrase('I am interested in photography.', 'be interested in', deriveAcceptedForms('be interested in'))).toBe(true)
    expect(includesPhrase('I changed my mind after lunch.', "change one's mind", deriveAcceptedForms("change one's mind"))).toBe(true)
    expect(includesPhrase('The snow prevented several trains from leaving.', 'prevent ... from', deriveAcceptedForms('prevent ... from'))).toBe(true)
    expect(includesPhrase('This route is as quick as the motorway.', 'as ... as')).toBe(true)
    expect(includesPhrase('Could you speak more slowly?', 'Could you ...?')).toBe(true)
  })

  it('does not invent a regular past form for the irregular verb cast', () => {
    expect(includesPhrase('The result cast doubt on the claim.', 'cast doubt on', deriveAcceptedForms('cast doubt on'))).toBe(true)
    expect(deriveAcceptedForms('cast doubt on')).not.toContain('casted doubt on')
  })

  it('rejects the retired subject-predicate plural marker instead of treating it as a wildcard', () => {
    expect(phraseSearchRegExp('stakeholders ...pluralverb')).toBeUndefined()
    expect(includesPhrase('Stakeholders were consulted.', 'stakeholder', ['stakeholders ...pluralverb'])).toBe(false)
  })
})
