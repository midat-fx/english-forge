import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

/**
 * Маргиналия — a note in the margin.
 *
 * Dense housekeeping text ("full route today ≈ 24 min; the review block is
 * capped by your 20-min setting…") is real information that nobody needs on the
 * emotional surface of a page. In an edition it goes in the margin.
 *
 * ≥xl it sits in the margin column, set small and turned a fraction of a degree.
 * Below xl it becomes a plain block right after the thing it annotates, in DOM
 * order, with no JS. That is not a regression, because a margin note is short
 * by construction.
 *
 * KEEP UNDER ~90 CHARACTERS. Anything longer belongs in the body.
 */
export function MarginNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'mt-2 text-xs leading-relaxed text-muted',
        'xl:mt-0 xl:max-w-48 xl:[transform:rotate(-0.3deg)]',
        className,
      )}
    >
      {children}
    </p>
  )
}
