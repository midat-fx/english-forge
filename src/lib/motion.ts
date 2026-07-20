/**
 * Single source of truth for motion timing.
 *
 * The app has two independent reduced-motion signals and both must be honoured:
 * the OS media query, and the app's own `Уменьшить движение` toggle, which
 * lands as `:root.reduce-motion` (see App.tsx). CSS handles the declarative
 * side via the `--motion` multiplier; this module is the JS side.
 *
 * IRON RULE: no handler subscribes to `transitionend` / `animationend`.
 * Anything that must happen after an animation goes through
 * `setTimeout(fn, DUR.x * motionScale())`. A 0ms transition never fires
 * `transitionend` at all, so a listener-based phase machine would hang
 * forever the moment a user enables reduced motion.
 */

export function motionReduced(): boolean {
  if (typeof window === 'undefined') return true
  if (document.documentElement.classList.contains('reduce-motion')) return true
  // jsdom (and older WebViews) ship without matchMedia; absence is not a
  // reduced-motion signal, and throwing here would take a page down.
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Multiplier for every author-defined duration: 1 normally, 0 when motion is reduced. */
export function motionScale(): 0 | 1 {
  return motionReduced() ? 0 : 1
}

/** Durations in ms, mirroring the named primitives in index.css. */
export const DUR = {
  press: 90,
  underline: 180,
  lamp: 160,
  sheet: 320,
  cardOut: 140,
  cardIn: 240,
  strike: 320,
  leader: 420,
  settle: 260,
  typeset: 300,
} as const
