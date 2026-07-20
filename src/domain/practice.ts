import { canonicalizeEnglishSpelling, expandEnglishContractions, includesPhrase, matcherPatternLexicalSurface, normalizePhrase, phraseSearchRegExp } from './normalization'
import type { Phrase, Skill } from './types'

export interface PracticePrompt {
  instruction: string
  cue: string
  context: string
}

export interface ActivationErrorPrompt {
  instruction: string
  cue: string
  context: string
  kind: 'typical' | 'reconstruction'
  expectedCorrection: string
}

function canonicalizePracticeVerbSpelling(value: string): string {
  return value
    .replace(/\bpractis(?:ed|ing)\b/gu, (form) => form.replace('practis', 'practic'))
    .replace(/\b(he|it|she)\s+practises\b/gu, '$1 practices')
    .replace(/\b((?:i|you|we|they)|(?:can|could|did|do|does|may|might|must|shall|should|to|will|would))\s+practise\b/gu, '$1 practice')
}

function normalizeAcceptedEnglishVariant(value: string, allowPracticeVerbVariant = false): string {
  const expanded = canonicalizeEnglishSpelling(normalizePhrase(expandEnglishContractions(value)))
  return (allowPracticeVerbVariant ? expanded.replace(/\bpractise\b/gu, 'practice') : canonicalizePracticeVerbSpelling(expanded))
    .replace(/[-–—]/gu, ' ')
    .replace(/[.,!?;:]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

export function activationRecognitionLabel(phrase: Phrase): string {
  return phrase.meaning.split(' · ')[0]?.trim() || phrase.meaning.trim()
}

export function clozeExpectedAnswer(phrase: Phrase): string {
  for (const form of [phrase.canonical, ...phrase.acceptedForms].filter(Boolean).sort((left, right) => right.length - left.length)) {
    const matcher = phraseSearchRegExp(form, true)
    const match = matcher?.exec(phrase.context)
    if (match) {
      const matchedSurface = match[0].slice(match[1]?.length ?? 0).trim()
      const lexicalSurface = matcherPatternLexicalSurface(form)
      if (!lexicalSurface) return matchedSurface
      const lexicalMatcher = phraseSearchRegExp(lexicalSurface)
      const lexicalMatch = lexicalMatcher?.exec(matchedSurface)
      if (lexicalMatch) return lexicalMatch[0].slice(lexicalMatch[1]?.length ?? 0).trim()
    }
  }
  return phrase.canonical
}

export function buildActivationErrorPrompt(phrase: Phrase): ActivationErrorPrompt {
  const authoredError = phrase.activationError
  if (authoredError
    && authoredError.incorrectContext !== authoredError.expectedCorrection
    && includesPhrase(authoredError.expectedCorrection, phrase.canonical, phrase.acceptedForms)) {
    return {
      instruction: 'Шаг 6 из 8 · исправление типичной ошибки',
      cue: authoredError.cue,
      context: authoredError.incorrectContext,
      kind: 'typical',
      expectedCorrection: authoredError.expectedCorrection,
    }
  }

  return {
    instruction: 'Шаг 6 из 8 · точное восстановление',
    cue: 'Для этой карточки нет отдельной редакторской пары ошибки. Восстановите целевое выражение в новом полном предложении.',
    context: phrase.meaning ? `Значение: ${phrase.meaning}` : 'Используйте выражение в понятном новом контексте.',
    kind: 'reconstruction',
    expectedCorrection: phrase.canonical,
  }
}

export function activationErrorResponseMatches(prompt: ActivationErrorPrompt, phrase: Phrase, response: string): boolean {
  const allowPracticeVerbVariant = [phrase.canonical, ...phrase.acceptedForms]
    .some((form) => /^(?:practice|practise)(?:\s|$)/u.test(normalizePhrase(form)))
  return prompt.kind === 'typical'
    ? normalizeAcceptedEnglishVariant(response, allowPracticeVerbVariant) === normalizeAcceptedEnglishVariant(prompt.expectedCorrection, allowPracticeVerbVariant)
    : includesPhrase(response, phrase.canonical, phrase.acceptedForms)
}

function lexicalTokens(value: string): Set<string> {
  return new Set(normalizePhrase(value).split(' ').filter((token) => token.length > 2))
}

function overlapRatio(left: string, right: string): number {
  const a = lexicalTokens(left)
  const b = lexicalTokens(right)
  if (!a.size || !b.size) return 0
  return [...a].filter((token) => b.has(token)).length / Math.min(a.size, b.size)
}

export function buildActivationChoices(phrases: readonly Phrase[], phrase: Phrase, mode?: 'recognition' | 'context_choice'): string[] {
  if (mode !== 'recognition' && mode !== 'context_choice') return []
  const value = (item: Phrase) => mode === 'recognition'
    ? activationRecognitionLabel(item)
    : redactAcceptedForms(item.context, item.canonical, item.acceptedForms)
  const answer = value(phrase)
  const candidates = phrases
    .filter((item) => item.id !== phrase.id && normalizePhrase(item.canonical) !== normalizePhrase(phrase.canonical) && item.status !== 'archived' && item.status !== 'needs_enrichment' && value(item).trim() && value(item) !== answer)
    .filter((item) => overlapRatio(item.meaning, phrase.meaning) < 0.6)
    .map((item) => ({
      item,
      score: (item.cefr === phrase.cefr ? 6 : 0)
        + (item.kind === phrase.kind ? 4 : 0)
        + item.tags.filter((tag) => phrase.tags.includes(tag)).length * 2
        + item.register.filter((register) => phrase.register.includes(register)).length,
      tie: [...`${phrase.id}:${item.id}:${mode}`].reduce((hash, character) => (Math.imul(hash, 33) + character.codePointAt(0)!) >>> 0, 11),
    }))
    .sort((left, right) => right.score - left.score || left.tie - right.tie)
  const distractors = candidates.slice(0, 2).map(({ item }) => value(item))
  const choices = [answer, ...distractors]
  const offset = [...`${phrase.id}-${mode}`].reduce((sum, character) => sum + character.codePointAt(0)!, 0) % Math.max(1, choices.length)
  return [...choices.slice(offset), ...choices.slice(0, offset)]
}

export function redactAcceptedForms(context: string, canonical: string, acceptedForms: string[]): string {
  return [canonical, ...acceptedForms]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .reduce((result, form) => {
      const matcher = phraseSearchRegExp(form, true)
      if (!matcher) return result
      const lexicalSurface = matcherPatternLexicalSurface(form)
      if (!lexicalSurface) return result.replace(matcher, (_match, prefix: string) => `${prefix}________`)
      const lexicalMatcher = phraseSearchRegExp(lexicalSurface, true)
      return result.replace(matcher, (match, prefix: string) => {
        const surface = match.slice(prefix.length)
        const redacted = lexicalMatcher
          ? surface.replace(lexicalMatcher, (_lexicalMatch, lexicalPrefix: string) => `${lexicalPrefix}________`)
          : surface
        return `${prefix}${redacted}`
      })
    }, context)
}

export function buildPracticePrompt(phrase: Phrase, skill: Skill): PracticePrompt {
  const redactedContext = phrase.context ? redactAcceptedForms(phrase.context, phrase.canonical, phrase.acceptedForms) : ''
  if (skill === 'cloze') {
    return {
      instruction: 'Пропуск · восстановите всё выражение',
      cue: phrase.meaning || 'Вставьте пропущенное выражение.',
      context: redactedContext.includes('________') ? redactedContext : `Используйте выражение со значением: ${phrase.meaning}`,
    }
  }
  if (skill === 'written_productive') {
    const redactedMeaning = phrase.meaning ? redactAcceptedForms(phrase.meaning, phrase.canonical, phrase.acceptedForms) : ''
    return {
      instruction: 'Свободный пример · вспомните и используйте естественно',
      cue: 'Составьте новое предложение по смысловой подсказке, не открывая целевую форму.',
      context: redactedMeaning
        ? `Нужное значение: ${redactedMeaning}`
        : redactedContext
          ? `Исходный контекст с пропуском: ${redactedContext}`
          : 'Вспомните выражение и используйте его в понятном новом контексте.',
    }
  }
  return {
    instruction: 'Активное вспоминание · от значения к выражению',
    cue: phrase.meaning || 'Вспомните выражение по исходному контексту.',
    context: redactedContext ? `Контекст: ${redactedContext}` : '',
  }
}

export function responseMatchesPractice(phrase: Phrase, skill: Skill, response: string): boolean {
  if (skill === 'cloze') return normalizePhrase(response) === normalizePhrase(clozeExpectedAnswer(phrase))
  if (!includesPhrase(response, phrase.canonical, phrase.acceptedForms)) return false
  if (skill !== 'written_productive') return true

  const normalized = normalizePhrase(response)
  const bareForms = [phrase.canonical, ...phrase.acceptedForms].map(normalizePhrase)
  if (bareForms.includes(normalized)) return false
  const responseWords = normalized.split(' ').filter(Boolean).length
  const shortestTarget = Math.min(...bareForms.map((form) => form.split(' ').filter(Boolean).length))
  return responseWords >= shortestTarget + 2
}
