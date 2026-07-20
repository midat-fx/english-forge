export interface GrammarAcademySource {
  title: string
  publisher: string
  url: string
  usedFor: string
  accessedAt: string
}

/**
 * Curriculum references only. Every explanation, example, correction and quiz in
 * English Forge is newly written; source wording is not reproduced.
 */
export const grammarAcademySources: readonly GrammarAcademySource[] = [
  {
    title: 'A1–A2 grammar',
    publisher: 'British Council LearnEnglish',
    url: 'https://learnenglish.britishcouncil.org/free-resources/grammar/a1-a2',
    usedFor: 'A2 topic coverage and lesson sequencing',
    accessedAt: '2026-07-16',
  },
  {
    title: 'B1–B2 grammar',
    publisher: 'British Council LearnEnglish',
    url: 'https://learnenglish.britishcouncil.org/free-resources/grammar/b1-b2',
    usedFor: 'B1 and B2 topic coverage',
    accessedAt: '2026-07-16',
  },
  {
    title: 'C1 grammar',
    publisher: 'British Council LearnEnglish',
    url: 'https://learnenglish.britishcouncil.org/free-resources/grammar/c1',
    usedFor: 'C1 structures and progression',
    accessedAt: '2026-07-16',
  },
  {
    title: 'English Grammar Today: Words, sentences and clauses',
    publisher: 'Cambridge Dictionary',
    url: 'https://dictionary.cambridge.org/grammar/british-grammar/words-sentences-and-clauses',
    usedFor: 'Clause, linking, word-order and focus taxonomy',
    accessedAt: '2026-07-16',
  },
  {
    title: 'English Grammar Today: Conditionals',
    publisher: 'Cambridge Dictionary',
    url: 'https://dictionary.cambridge.org/grammar/british-grammar/conditionals',
    usedFor: 'Conditional system coverage',
    accessedAt: '2026-07-16',
  },
  {
    title: 'English Grammar Today: Reported speech',
    publisher: 'Cambridge Dictionary',
    url: 'https://dictionary.cambridge.org/grammar/british-grammar/reporting-clauses',
    usedFor: 'Reported statements, questions and reporting patterns',
    accessedAt: '2026-07-16',
  },
  {
    title: 'English Grammar Today: Cleft sentences',
    publisher: 'Cambridge Dictionary',
    url: 'https://dictionary.cambridge.org/grammar/british-grammar/cleft-sentences',
    usedFor: 'Advanced emphasis structures',
    accessedAt: '2026-07-16',
  },
  {
    title: 'Common European Framework of Reference for Languages',
    publisher: 'Council of Europe',
    url: 'https://www.coe.int/en/web/common-european-framework-reference-languages/introduction-and-context',
    usedFor: 'CEFR level framework and curriculum alignment',
    accessedAt: '2026-07-16',
  },
  {
    title: 'Introducing the CEFR for English',
    publisher: 'English Profile / Cambridge University Press & Assessment',
    url: 'https://www.englishprofile.org/images/pdf/theenglishprofilebooklet.pdf',
    usedFor: 'Grammatical progression and criterial feature cross-check',
    accessedAt: '2026-07-16',
  },
] as const
