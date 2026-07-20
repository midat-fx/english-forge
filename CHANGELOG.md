# Changelog

Notable changes to English Forge, newest first.

## 0.7.1

### Session — cards as the core
- New **Session** page replaces Practice as the primary training surface. One simple loop: see a word, pick one of three answers, read the translation and example, move on with the **Next** button or Enter — the pace is always the learner's.
- Decks mix today's new words with due reviews. Directions: EN→RU, RU→EN, or shuffled. A correct review answer records a normal "Good" grade into the scheduler; a wrong one records "Again". **"I already know this"** removes a word from reviews while keeping it in the reference.
- Extra rounds beyond the scheduled deck are pure training and never distort the review schedule.
- The deep eight-step activation cycle remains available as **Advanced practice**.

### Listening
- The daily dictation now shows a clear verdict after checking: pass or not yet, a words-in-place score against the threshold, and a word-level diff of the reference versus what you heard (behind "Show breakdown").
- **Repeat this phrase** and **New phrase** buttons let the learner choose their own load instead of one phrase per day.
- The own-material composer (import a podcast or lecture fragment) is collapsed behind a single optional disclosure and rewritten as plain numbered steps.

### macOS recording fix
- Recordings are now captured as **mp4 first**: the WKWebView engine used by the desktop app cannot play back webm at all, which made recorded takes silently unplayable. Stored recordings without a container type are served untyped so the engine can sniff them.
- If a captured take decodes to silence (usually a macOS microphone-permission issue), the recorder now says so and points to the exact System Settings switch instead of playing nothing.

### Clarity
- A plain-language pass across every screen: developer terms (activation, SRS, evidence, local/system qualifiers, reference transcript) replaced with words a learner uses; redundant disclaimer chips removed; the daily-route summary shortened to the numbers that matter.
- Dead-end screens ("step not scheduled today") rewritten to explain the why in human terms and offer a next action.
- Configurable **new words per day** (1–30) in Settings.
- Form and validation errors are shown in amber everywhere; red is reserved for editorial marks and destructive actions, never for the learner's mistakes.

### Design
- Motion pass guided by a frequency-first audit: one unified 160 ms ease-out for interactive transitions, entrance gestures for cards, verdicts, brackets, the mobile navigation drawer, and the session-summary stamp. Every animation is event-driven, ends in its final state, and is fully neutralized under reduced motion (system setting and the in-app toggle).
- Dialog opening no longer jumps: the entrance animates opacity and scale only, composing correctly with the centering transform.

### Distribution
- The macOS build is **universal** (Apple Silicon + Intel). CI publishes both installers — macOS DMG and Windows NSIS — to GitHub Releases on every version tag, downloadable without a GitHub account.

### Checks
- Test suite: 62 files, 486 tests (Vitest), all passing; 12 Rust storage-safety tests passing.

## 0.7.0

### Design
- Full redesign. The app is set like a proof sheet on warm, heavy paper under a single desk lamp: three paper elevations lit by one light source, exactly two inks (a rubric red for editorial marks and a green stamp for accepted work), near-square radii, and a serif face reserved for English study content while the Russian interface uses a grotesque. Nothing animates on a loop.

### Multi-profile
- Several learners in one installation. A launch picker ("Who's studying?"), a profile switcher in the sidebar, and profile management in Settings.
- Profiles are stored as named entries inside a single local container file. Each profile is fully isolated (its own placement, vocabulary, and history) and stays on this device only; there is no cross-device sync.
- Handing the app to a friend: they create their own profile and take the diagnostic; all of their data stays on their computer. A profile can be moved between machines through JSON export/import (learning history and metadata; audio bytes are not transferred).

### Audit fixes
- **Leech resume:** suspended leech skills correctly return to gentle relearning.
- **Monotonic placement ladder:** a strong upper band (e.g. B2) can no longer demote a borderline lower-level learner.
- **Honest listening gate:** starting speech synthesis alone does not count as listening — full playback, a hidden dictation, and a separate comprehension question are required.
- **Bounded histories:** day/level records, Error Lab occurrences, and related logs have explicit size limits.
- **Reveal = Again:** revealing the answer is recorded as supported practice (graded no higher than "Hard") and creates no independent productive evidence.

### Platforms
- Windows build support (NSIS installer) added alongside macOS (DMG).
