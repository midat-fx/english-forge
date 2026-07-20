export interface CatalogMethodologySource {
  title: string
  organisation: string
  url: string
  purpose: string
}

/**
 * Methodology sources calibrate levels and activity design; all definitions,
 * translations and examples in English Forge remain original.
 */
export const lexicalCatalogMethodology = {
  edition: '2026-07-18',
  principles: [
    'Prioritise high-utility language for real communicative actions and familiar domains at A2–B1.',
    'Teach words together with collocations, grammar patterns, discourse functions, and register.',
    'Use one concise English meaning and one complete, original context sentence per item.',
    'Treat a CEFR label as a learning recommendation, not a claim that an expression belongs exclusively to one level.',
  ],
  sources: [
    {
      title: 'CEFR Companion Volume (2020)',
      organisation: 'Council of Europe',
      url: 'https://book.coe.int/en/education-and-modern-languages/8150-common-european-framework-of-reference-for-languages-learning-teaching-assessment-companion-volume.html',
      purpose: 'Action-oriented CEFR descriptors and communicative competence framework.',
    },
    {
      title: 'CEFR common reference levels and self-assessment grid',
      organisation: 'Council of Europe',
      url: 'https://www.coe.int/en/web/common-european-framework-reference-languages/level-descriptions',
      purpose: 'Broad functional distinctions among A2, B1, B2, and C1.',
    },
    {
      title: 'Introductory Guide to the CEFR for English',
      organisation: 'English Profile / Cambridge University Press',
      url: 'https://www.englishprofile.org/images/pdf/GuideToCEFR.pdf',
      purpose: 'English-specific, corpus-informed interpretation of learner language by CEFR level.',
    },
    {
      title: 'English Vocabulary Profile user guide',
      organisation: 'English Profile',
      url: 'https://www.englishprofile.org/images/pdf/evp%20user%20guide.pdf',
      purpose: 'Sense-level vocabulary profiling methodology and caveats about level assignment.',
    },
    {
      title: 'A1–A2 vocabulary',
      organisation: 'British Council LearnEnglish',
      url: 'https://learnenglish.britishcouncil.org/free-resources/vocabulary/a1-a2',
      purpose: 'Everyday topic coverage and learner-facing activity design for basic users.',
    },
    {
      title: 'B1–B2 vocabulary',
      organisation: 'British Council LearnEnglish',
      url: 'https://learnenglish.britishcouncil.org/free-resources/vocabulary/b1-b2',
      purpose: 'Independent-user topic coverage and communication goals.',
    },
    {
      title: 'Activities for learners',
      organisation: 'Cambridge English',
      url: 'https://www.cambridgeenglish.org/learning-english/activities-for-learners/',
      purpose: 'CEFR-banded skills, vocabulary, and grammar activity taxonomy.',
    },
  ] satisfies CatalogMethodologySource[],
} as const
