import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

/**
 * This is where "make the buttons light up" is answered — with three
 * simultaneous physical signals instead of a coloured halo:
 *   1. the lamp edge brightens along the top bevel and the key lifts (.lamp),
 *   2. an ink rule grows along the bottom edge (.ink-underline),
 *   3. the key sinks one pixel on press with an inset shadow (.detent).
 * A symmetric glow around an element is the visual signature of a generic dark
 * dashboard; a lit bevel with its shadow falling down-right is a lit object.
 *
 * Every size keeps `min-h-11` (44px) — the WCAG 2.2 AA target-size floor.
 *
 * Kept in its own module, not in Button.tsx: a file that exports both components
 * and plain functions breaks React Fast Refresh (oxlint react/only-export-components),
 * which downgrades every edit here to a full page reload during development.
 */
export const buttonVariants = cva(
  'detent lamp ink-underline relative inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] px-4 text-sm font-semibold shadow-[var(--lift-1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none',
  {
    variants: {
      variant: {
        primary: 'bg-teal text-ink hover:bg-teal-strong',
        // Rubric fill — the editor's red. Variant name kept for existing call sites.
        ember: 'bg-ember text-ink-warm hover:bg-ember-strong',
        secondary: 'border border-border bg-elevated text-primary hover:border-border-strong',
        ghost: 'text-secondary shadow-none hover:bg-elevated hover:text-primary hover:shadow-[var(--lift-1)]',
        // Destructive differs from a rubric mark by being FILLED, not by hue.
        danger: 'bg-danger text-ink-warm hover:bg-ember-strong',
      },
      size: {
        sm: 'min-h-11 px-3 text-xs',
        md: 'min-h-11 px-4',
        lg: 'min-h-12 px-5 text-base',
        icon: 'size-11 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonVariantProps = VariantProps<typeof buttonVariants>

/**
 * Строка классов кнопки для того, что кнопкой быть не может: <Link>/<a>.
 * Ссылка-в-роли-кнопки обязана нести те же три сигнала (lamp, ink-underline,
 * detent) и тот же focus-visible, иначе один и тот же по смыслу элемент
 * выглядит по-разному на разных экранах.
 */
export function buttonClass(opts?: ButtonVariantProps & { className?: string }): string {
  const { className, ...variants } = opts ?? {}
  return cn(buttonVariants(variants), className)
}
