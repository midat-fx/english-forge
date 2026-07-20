# English Forge

English Forge is a local-first macOS and Windows learning workbench for independent English learners from A2 through C1. It combines level placement, a curated language library, ordered grammar lessons, spaced review, listening, and speaking without requiring an account or cloud service. Several learners can share one installation through separate local profiles.

## V0.7 highlights

- **The Proof Sheet redesign:** the app is set like a proof sheet on warm, heavy paper under a desk lamp. Depth comes from one fixed light source and three paper levels — recessed, sheet, and slip — rather than from glow. There are exactly two inks: a rubric red for the editor's marks and a green stamp for what has been accepted. Rubric red never marks a learner mistake, so a wrong answer is amber, never red. English study text is set in a serif face and the Russian interface in a grotesque, which lets you tell the two languages apart at a glance. Nothing in the app animates on a loop: motion is spent on the one moment that repeats, the card turning over during practice.
- **Multiple learners, one app:** a launch picker ("Кто занимается?" / "Who's studying?") lets each learner open their own profile, with an in-sidebar profile switch and profile management in Settings. Profiles live as named entries inside a single local container file; each profile is fully isolated and stored only on this device, and there is **no** cross-device sync. Handing the app to a friend simply means they create their own profile and take the diagnostic — all of their data stays on their computer. A profile can be moved between machines through JSON export/import, which carries learning history and metadata only; audio bytes are never transferred.
- **Placement first:** 32 original multiple-choice questions cover grammar, vocabulary, reading, and Use of English across A2–C1. An optional eight-item local TTS listening block reports comprehension and dictation separately and never changes the core CEFR route. The result remains an approximate working range, not an official certificate.
- **Daily ten:** each local day brings a stable 10-card Discovery set from the complete bilingual catalog at the learner's current level. Meaning and examples stay hidden until a correct unaided choice; a wrong choice must be retried and is not persisted as success. Only reviewed activation-ready cards may enter the separately capped deep eight-step cycle. Assignment, replacement, enrollment, and catalog reconciliation resolve against the frozen canonical lazy-loaded catalog rather than caller-provided rows; 320 bounded day/level records cover a complete pass through the current largest level even when all four levels are opened daily.
- **Curated language library:** 2,164 unique words, collocations, phrasal verbs, discourse markers, formulas, and useful patterns: A2 800, B1 305, B2 634, and C1 425. The reviewed activation course admits 1,012 items with an authored Step-6 error/correction pair (A2 160, B1 305, B2 282, C1 265); 1,152 additional entries remain reference-only. Reference-only cards participate in Discovery and can be copied into My Words for stages 1–5; stage 6 stays gated until the learner supplies a real error/correction pair.
- **Fail-closed language matching:** all 660 single-word rows have reviewed part-of-speech/morphology decisions (242 count nouns, 61 non-count nouns, 136 gradable adjectives, and 221 deliberately inert rows). Of the count nouns, 117 noun/verb homographs and conservative borderlines require an immediate grammatical cue; only 125 reviewed rows accept a bare plural. All 155 reviewed nominal collocations have authored plural surfaces and an explicit boundary policy: 77 bare-safe, 27 strict-count-cue only, 38 determiner-only, and 13 intentionally unsupported as ambiguous. Retired matcher syntax cannot act as a wildcard. Internal patterns stay hidden from learners, and the exact Step-6 scorer shares reviewed UK/US spelling and contraction normalization.
- **Stable identity:** 36 previously reused catalog IDs were retired and replaced with semantic IDs. A versioned ledger and conditional profile migration protect old learning evidence instead of moving it to a different expression.
- **Evidence-safe practice:** a five-minute session stays within three tasks and still reserves due SRS work. Feedback and reveal create durable phrase-wide exposure provenance before the answer appears; another skill for that phrase is withheld for 12 hours, and a direct bypass is capped as supported practice rather than independent evidence.
- **Your own database:** add individual items or a starter set to My Words, enrich incomplete duplicates, and review them with the spaced-practice system.
- **Grammar Academy:** 124 ordered lessons from A2 through C1 and 372 original questions. Each lesson has a concise explanation, formula, three examples, a corrected common mistake, and a three-question knowledge check. Current mastery requires two spaced versioned checks, a verified correction, an original production, and a delayed transfer with a separate 3/3 construction check; older evidence remains history. A2–B1 also includes Russian support.
- **Simpler navigation:** Today, Words & phrases, Grammar, Practice, Listen & speak, and Progress form the primary learning route.
- **Evidence-safe schema V6:** V0.1–V0.5 profiles migrate without deleting drafts, history, or local media metadata. Imported mission, listening, speaking, and grammar claims are recomputed; unverifiable legacy claims remain visible history but no longer create mastery.
- **Voice and diagnostics:** manual transcripts can be imported from TXT, SRT, or VTT. A post-placement portfolio links verifiable listening, recorded speaking, and writing samples while explicitly avoiding automatic accent or official CEFR claims.

Voice Lab, local screen/application-audio capture, the Listening Library, detailed phrase editing, Error Lab, missions, session building, and event-derived progress remain available from the earlier release.

## Privacy and local media

Core practice works offline. No learner text or audio is sent to a network service, and no cloud API is configured.

Audio recording begins only after an explicit button press. Native macOS builds use no-follow directory handles and `openat`/`renameat`/`unlinkat` operations under the app-data `recordings` directory, with sanitized IDs, a 25 MiB per-file limit, bounded reads, and atomic writes. Browser development uses IndexedDB. Profile JSON stores only media metadata—never base64 audio. New audio is compensated if its durable metadata commit fails; deletion commits metadata first and then removes the now-unreferenced file. Startup reconciliation enumerates the media library and retries removal of orphaned files.

The normal JSON export is a **metadata backup**: it contains learning history and recording IDs, but not audio bytes. Import preflight refuses to replace the current profile when any referenced audio is missing on this device. Recordings remain until an explicit Voice Lab deletion or full profile reset; no automatic expiry is claimed. Whisper is not bundled; manual transcripts keep the product useful without a large model, and the app never generates a pronunciation or accent score.

## Install

English Forge targets both macOS and Windows from the same codebase.

**macOS.** The packaged build targets Apple Silicon (`arm64`) and macOS 11.0 or later. Open the DMG, drag **English Forge** to **Applications**, then launch it. The locally produced artifact is ad-hoc signed but not Apple-notarized, so macOS may require **Control-click → Open** on first launch.

**Windows.** The Windows build ships as an NSIS installer (`.exe`); run it and follow the prompts. The same profiles, catalog, and evidence rules apply; local audio uses the Windows app-data directory instead of the macOS-specific handle-based media path.

macOS asks for Microphone or Screen & System Audio Recording access only when the corresponding Voice Lab action is used. If screen capture is unavailable for a selected source, importing a permitted local clip remains available.

The profile is stored as an atomically replaced native file under the app's macOS data directory. A failed write is surfaced in the UI. Export JSON before resetting if you need the metadata later.

## Development

Requirements: Node.js 20.19+ or 22.12+ (Vite 8), pnpm 11, Rust, and the platform prerequisites for Tauri 2.

```bash
pnpm install
pnpm check
pnpm desktop:dev
```

Create the Apple Silicon desktop bundle with:

```bash
pnpm tauri build --bundles app,dmg
```

Hardened Runtime and the minimum audio-input entitlement are enabled in every build. A credential-checking Developer ID/notarization path and strict artifact verifier are documented in [`RELEASE_MACOS.md`](RELEASE_MACOS.md); actual notarization still requires the maintainer's Apple certificate and credentials.

## Architecture

- React 19, TypeScript, Vite, and Tailwind CSS 4.
- Zustand with narrow page subscriptions, strict Zod validation, persisted schema migration, and recovery controls.
- Tauri 2 atomic profile/media commands; handle-based Unix media access; browser fallbacks use localStorage and IndexedDB.
- Pure scheduling, normalization, lifecycle, and progress modules.
- Vitest and Rust coverage for migration, prompt leakage, persistence boundaries, audio safety, evidence rules, queue interleaving, and store invariants.

## License

MIT
