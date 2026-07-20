import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

/**
 * Paper levels. The single fix for "every panel looks the same": a page is not
 * a grid of equal boxes but a sheet with things cut into it and slips stuck on
 * top of it. All three are lit by the one light source declared in index.css.
 *
 * recess — cut into the sheet: metric wells, field containers, empty slots.
 * leaf   — the sheet itself: the default, main content surfaces.
 * slip   — a paper slip glued on top, sitting at a flat angle. The rotation is
 *          a plain 2D `rotate`, not a perspective tilt: it reads as more solid
 *          than any cursor-tracking tilt, costs nothing, needs no JS, and does
 *          not force the subtree to stay rasterised (which softens the serif).
 */
type Level = 'recess' | 'leaf' | 'slip'

const LEVELS: Record<Level, string> = {
  recess: 'rounded-[3px] bg-recess shadow-[var(--bevel-down)]',
  leaf: 'rounded-[3px] border border-border bg-surface shadow-[var(--lift-1)]',
  slip: 'rounded-[2px] border border-border bg-elevated shadow-[var(--lift-2)] [transform:rotate(-0.35deg)] even:[transform:rotate(0.28deg)]',
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  level?: Level
}

export function Card({ className, level = 'leaf', ...props }: CardProps) {
  return <div className={cn('min-w-0', LEVELS[level], className)} {...props} />
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-start justify-between gap-4 border-b border-border px-5 py-4', className)} {...props} />
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}
