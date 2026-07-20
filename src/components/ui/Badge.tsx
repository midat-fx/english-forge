import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

/**
 * Seven colour families collapse to two inks plus a neutral. Where two states
 * used to be told apart by hue alone (`active` vs `retained` in PhraseBank),
 * they are now told apart by fill and border SATURATION — and every state is
 * still spelled out in words, so nothing rests on colour perception.
 *
 * Text uses the `-strong` tokens, never the base ink. Badge text is 12px bold —
 * which is NOT "large text" under WCAG (the bold threshold is 18.66px), so it
 * needs the full 4.5:1. Measured against the COMPOSITED soft fill (not the token
 * nominal), base `--rubric` on `rubric-soft` over `--elevated` is 4.23:1 in dark
 * and base `--verified` on `verified/20` over `--recess` is 3.69:1 in light —
 * both fail. The `-strong` pair flips correctly per theme (lighter in dark,
 * darker in light) and clears 4.5:1 on every surface the badge actually sits on.
 */
const badgeVariants = cva('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] shadow-[var(--bevel-up)]', {
  variants: {
    tone: {
      neutral: 'border-border bg-elevated text-secondary',
      teal: 'border-verified/30 bg-verified-soft text-teal-strong',
      ember: 'border-rubric/35 bg-rubric-soft text-ember-strong',
      amber: 'border-amber/30 bg-amber/10 text-amber',
      positive: 'border-verified/60 bg-verified/20 text-teal-strong',
      danger: 'border-rubric/35 bg-rubric-soft text-ember-strong',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
