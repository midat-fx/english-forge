import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

/**
 * Штемпель отсрочки — the "closed lid".
 *
 * Interval waiting (a transfer that is not ready, a grammar lesson locked for
 * twelve hours, a clip in its five-minute quarantine) currently reads as a
 * broken screen: everything grey and disabled, with no explanation. A hatched
 * panel with a stamped caption reads as DELIBERATELY CLOSED — the same state,
 * correctly framed. Dormancy becomes an intended state rather than a bug.
 *
 * Entirely static: zero animation.
 */
export function Stamp({
  caption,
  children,
  className,
}: {
  caption: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'hatched relative flex flex-col items-center justify-center gap-2 rounded-[2px] border border-border-strong px-5 py-6 text-center',
        className,
      )}
    >
      <span className="label-caps rounded-[2px] border border-rubric/50 px-2.5 py-1 text-rubric [transform:rotate(-2.5deg)]">
        {caption}
      </span>
      {children && <div className="text-sm text-secondary">{children}</div>}
    </div>
  )
}
