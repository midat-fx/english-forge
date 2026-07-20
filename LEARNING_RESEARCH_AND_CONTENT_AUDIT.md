# Methodology and Learning-Content Audit

Audit date: 18 July 2026. This is a methodology note, not a claim of official CEFR accreditation.

## What was checked

The audit ran against production aggregates, not individual source files or a hand-picked showcase:

- all 2,164 catalog and reference cards: A2 — 800, B1 — 305, B2 — 634, C1 — 425; the production gate for the 1,012 activation-ready cards with an authored Step-6 pair was verified separately;
- all 124 grammar lessons and 372 questions;
- all 32 placement-test questions, keys, answer options, remedial-lesson links, and the scoring logic;
- the B1 production assembly and its provenance: only four files of static authored rows are included; the four former bulk generators and the shared templater are excluded from the production catalog;
- a uniform editorial sample of 40 cards per level (160 cards), separate from the automated checks;
- an independent strict re-check of all 305 B1 targets, meanings, and Step-6 pairs for level fit and naturalness;
- the full registry of all 660 single-word rows: 242 count nouns, 61 non-count, 136 gradable adjectives, and 221 fail-closed; within the count nouns, the 117 context-only homographs/borderline cases and the 125 bare-safe rows were checked separately;
- 155 nominal collocations with per-item plural surfaces and a boundary policy (77 bare-safe, 27 strict-count-cue, 38 determiner-only, 13 unsupported as ambiguous), plus a separate list of mass, already-plural, and fixed expressions that do not extend productively.

The permanent full pass is implemented in `src/data/learningContentAudit.ts` and `src/data/learningContentAudit.test.ts`. It verifies ID uniqueness, cross-level fingerprints, bilingual-field completeness, technical fragments, target-expression presence in the example via accepted forms, example duplication, grammar keys, the Russian support for A2–B1, placement links, and the distribution of correct-answer positions.

## Audit outcome

After the fixes, the automated audit finds no Critical defects in the production catalogs.

- Vocabulary: the catalog and reference hold 2,164 cards. 1,012 cards with a separately authored Step-6 pair are admitted into the active course: A2 — 160, B1 — 305, B2 — 282, C1 — 265. The remaining 1,152 stay reference-only (A2 — 640, B2 — 352, C1 — 160) until they have a reviewed error → correction pair. All 305 B1 cards carry such a verifiable exercise.
- B1: two strict extra passes surfaced 75 source rows that needed a replaced target or a narrowed meaning — 49 in the first pass and another 26 in the second. A follow-up identity audit found that 35 of those B1 replacements and one A2 replacement had wrongly kept the ID of the previous meaning. All 36 new targets received new semantic IDs; a versioned ledger and a conditional migration preserve the evidence of the old meaning.
- B2: 14 useful rows had been wrongly excluded as lower-level duplicates although the corresponding A2/B1 targets no longer existed. They were restored, given individual editorial Step-6 pairs, and pass the exclusion-closure check.
- Examples: 2,164 of 2,164 end with punctuation, are unique after normalization, and contain the target expression or an explicitly described accepted form.
- Pattern metadata: added for all 29 automatically detected open frames and constructions with an obligatory complement, including `be similar to + noun`, `I prefer + noun / -ing / to-infinitive`, `cut down on + noun / -ing`, and the paired `the more ..., the more ...` construction.
- Grammar: 124 unique lessons, 372 unique questions; Russian support is present in all 73 A2–B1 lessons.
- Placement: the key used to leak badly — the correct answer never sat in position D. Each level now has exactly two A/B/C/D keys, 8/8/8/8 in total. All remedial links resolve to existing lessons.
- Retrieval/SRS: the short plan uses a single limit and never lets activation crowd out due reviews. Feedback or reveal is recorded before the answer is shown as durable phrase-wide exposure; another skill of the same phrase stays closed for 12 hours even across a remount, and imported review history is recomputed under the same rule.
- Morphology and exact matching: new forms are no longer derived from an indefinite article or a generic template. Reviewed noun/adjective/collocation surfaces are bound to both the stable ID and the exact expression; the cloze and productive matchers require grammatical context. British/American variants and natural contractions are normalized centrally, and ambiguous cases remain fail-closed.

Known limitations:

1. The full B1 catalog is still smaller than A2, B2, and C1: 305 cards. The level grows only through new static rows and individual editorial Step-6 repairs, not through a combinatorial generator.
2. The core placement samples grammar, vocabulary, reading, and Use of English evenly. The optional TTS block adds a separate listening signal, and the portfolio adds completed speaking/writing samples, but the app still performs no validated automatic assessment of productive quality and must say so plainly.
3. A card's CEFR label is a study-moment recommendation, not a claim that a word "belongs" to a single level. A full per-sense EVP verification is unavailable without a licensed corpus/interface; no paid content was copied.

## Decisions and sources

All card and exercise wording is original. Sources were used only as a methodological and validation basis.

### CEFR, curriculum, and placement

- [Council of Europe — CEFR Companion Volume (2020)](https://rm.coe.int/cefr-companion-volume-with-new-descriptors-2020/16809ea0d4). Influence: action-oriented can-do goals; separating reception, production, interaction, and mediation; refusing to call a short language-knowledge test an official CEFR certificate; prioritizing intelligibility over imitating a "native accent".
- [Council of Europe — searchable CEFR descriptors](https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors-search). Influence: functional level verification and goals phrased as observable actions.
- [English Profile — English Vocabulary Profile user guide](https://www.englishprofile.org/images/pdf/evp%20user%20guide.pdf). Influence: level assignment is considered per meaning and use, not per bare lemma; polysemy requires separate senses or explicit constraints.
- [English Profile — introductory guide to the CEFR for English](https://www.englishprofile.org/images/pdf/GuideToCEFR.pdf). Influence: grammar progression is treated as a corpus-informed guideline, not a rigid universal list.
- [Cambridge English — Cambridge English Placement Test](https://www.cambridgeenglish.org/find-a-centre/exam-centres/support-for-centres/placing-students-in-the-right-exam/). Influence: a valid placement should distinguish Reading, Listening, and Language Knowledge and may be adaptive; English Forge honestly limits its claims given the absent listening/productive modules.
- [Cambridge English — CEFR and language standards](https://www.cambridgeenglish.org/exams-and-tests/cefr/). Influence: the working level is presented as an understandable range and route, with no false equivalence to an exam.
- [British Council — vocabulary by level](https://learnenglish.britishcouncil.org/free-resources/vocabulary). Influence: A2–B1 gets everyday, topical, communicatively useful priority; meaning, spelling, and pronunciation should be trained together.

### Retrieval, spacing, testing, and interleaving

- [Karpicke & Roediger (2008), "The Critical Importance of Retrieval for Learning"](https://doi.org/10.1126/science.1152408). Influence: repeated retrieval rather than re-reading after the first success; productive recall stays a separate skill state.
- [Cepeda et al. (2006), distributed-practice meta-analysis](https://doi.org/10.1037/0033-2909.132.3.354). Influence: reviews are distributed over time; the interval is tied to the desired retention horizon, not to a fixed daily showing.
- [Kim & Webb (2022), spaced practice in L2 meta-analysis](https://doi.org/10.1111/lang.12479). Influence: spacing is applied to L2 vocabulary and grammar; longer spacing matters more for delayed retention, while equal spacing is not treated as inferior to expanding spacing by default.
- [Nakata & Suzuki (2019), spacing and semantic relatedness in L2 vocabulary](https://doi.org/10.1017/S0272263118000219). Influence: the daily queue interleaves expressions and does not serve large semantically uniform blocks as the only mode.
- [Rohrer & Taylor (2007), interleaved practice](https://doi.org/10.1007/s11251-007-9015-8). Influence: the queue alternates targets and skills instead of stacking several tasks on one card in a row.
- [Bjork & Bjork (2011), desirable difficulties](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/11/Making-Things-Hard-on-Yourself-but-in-a-Good-Way-20111.pdf). Influence: added difficulty is acceptable only while retrieval stays achievable; hints/reveal cap the grade, and a missed answer can never be declared Easy.

### Vocabulary depth, chunks, and contextual encoding

- [Li & Lei (2024), collocation-instruction meta-analysis](https://doi.org/10.1515/iral-2021-0218). Influence: collocations and lexical chunks are represented as separate targets; constrained and free production complement recognition.
- [Boers et al. (2006), formulaic sequences and perceived oral proficiency](https://doi.org/10.1191/1362168806lr195oa). Influence: the app teaches whole formulas, while pattern metadata keeps the internal structure visible.
- [Boers & Lindstromberg (2012), experimental studies on formulaic sequences](https://doi.org/10.1017/S0267190512000050). Influence: noticing, retrieval, and context are used together; a bare translation list is not considered sufficient teaching.
- [Puimège et al. (2019), context and word predictors in L2 vocabulary learning](https://doi.org/10.1017/S0142716418000504). Influence: every card requires meaningful context; this is why the mechanically assembled B1 bulk set was excluded from production entirely, even where individual rows passed surface-level formal checks.

### Feedback, pronunciation, listening, and speaking

- [Li (2010), corrective-feedback meta-analysis](https://doi.org/10.1111/j.1467-9922.2010.00561.x). Influence: feedback comes after the attempt and preserves the correct form; mistakes become separately retrievable patterns, not just red highlighting.
- [Lyster & Saito (2010), oral feedback in classroom SLA](https://kazuyasaito.net/SSLA2010.pdf). Influence: prompts, correction, and delayed reuse are combined; self-assessment without observable evidence does not raise mastery.
- [Saito (2012), pronunciation instruction synthesis](https://doi.org/10.1002/tesq.67). Influence: explicit attention to form is paired with meaningful speech; the goal is comprehensibility and control, not "getting rid of the accent".
- [British Council — pronunciation practice](https://learnenglish.britishcouncil.org/level/improve-your-english-level/how-can-i-improve-my-english-pronunciation). Influence: short listen-and-write, comparison with a transcript, recording yourself, and repeating the original; slowdown is available as support.
- [Whitworth & Rose (2025), systematic review of shadowing](https://doi.org/10.1080/29984475.2025.2546827). Influence: shadowing remains scaffolded practice, not a proven automatic pronunciation assessment; long-term and advanced-level effects are treated cautiously.
- [Mahalingappa, Zong & Polat (2024), captions and playback speed](https://doi.org/10.1016/j.system.2023.103192). Influence: captions/transcripts and 0.75×/1×/1.25× speeds are treated as learner-controlled support; effects depend on proficiency, so speed is never used as a standalone level measure.
- [Kuşçu (2024), meta-analysis of L2 listening instruction](https://doi.org/10.1080/10904018.2022.2074851). Influence: listening needs its own comprehension tasks and repeated attempts, not passive background playback.

### Cognitive load and accessibility

- [Kalyuga, Ayres, Chandler & Sweller (2003), expertise-reversal effect](https://doi.org/10.1207/S15326985EP3801_4). Influence: A2–B1 gets Russian support and explicit formulas; scaffolding must shrink as expertise grows so it does not become extra load.
- [Kalyuga, Chandler & Sweller (1998), levels of expertise and instructional design](https://doi.org/10.1518/001872098779480587). Influence: the same amount of hinting is not imposed on every level; worked support is separated from the productive check.
- [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/). Influence: keyboard focus, visible labels, target size, contrast, reflow, reduced motion, understandable errors, and independence from any single sensory channel are readiness criteria for the learning UX.

## Rules for the next content revision

1. Do not grow the catalog by generating generic sentence frames.
2. Keep a stable ID through an editorial example replacement only if the canonical target and its meaning are unchanged; check against `lexicalCatalogIdentityHistory.ts`.
3. For a new target, or a new sense of a polysemous word, create a separate card with a new ID. Never "free up" an old ID for a different expression.
4. For every open frame / dependent preposition, set `pattern`; constraints and register go in `note`.
5. Verify the English example and the Russian translation as one meaning pair, including negation, modality, numbers, tense, and participants.
6. Before merging, run `pnpm vitest run src/data/learningContentAudit.test.ts src/data/placementTest.test.ts src/data/lexicalCatalog.test.ts src/data/grammarAcademy.test.ts`.
