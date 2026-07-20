import { cn } from '../../lib/utils'

/**
 * Строкомер — the typesetter's measuring rule. One primitive for every `{n}/{m}`
 * in the app (there were fifteen-odd, drawn five different ways with inline
 * `style={{ width: '%' }}`).
 *
 * Rendered as SVG rather than a conic-gradient or a CSS bar: hairline conic
 * hard-stops are the worst-antialiased thing in Blink/WebKit, and on Windows
 * WebView2 at 100% DPI they come out as ragged steps. SVG cuts cleanly and
 * costs nothing.
 *
 * The fraction is ONE text node, in one colour. That is a test contract, not an
 * aesthetic choice: splitting numerator and denominator into separate spans
 * would create nodes whose entire text is a single digit, which breaks
 * `getAllByText(/^[123]$/)` in GrammarAcademyPage.route.test.tsx.
 *
 * Rule NEVER prints a percentage — PhraseBankPage.test.tsx asserts `100%` never
 * reaches the screen.
 */
interface RuleProps {
  value: number
  max: number
  label?: string
  orientation?: 'horizontal' | 'vertical'
  showFraction?: boolean
  /** Adds role="progressbar" with aria-valuemin/max/now. */
  progressbar?: boolean
  ariaLabel?: string
  className?: string
}

export function Rule({
  value,
  max,
  label,
  orientation = 'horizontal',
  showFraction = true,
  progressbar = false,
  ariaLabel,
  className,
}: RuleProps) {
  const total = Math.max(1, Math.round(max))
  const filled = Math.max(0, Math.min(total, Math.round(value)))
  const ticks = Array.from({ length: total }, (_, i) => i)

  // `Готовность` is the exact accessible name the removed TemperatureBar had.
  const a11y = progressbar
    ? ({
        role: 'progressbar' as const,
        'aria-valuemin': 0,
        'aria-valuemax': total,
        'aria-valuenow': filled,
        'aria-label': ariaLabel ?? label ?? 'Готовность',
      })
    : {}

  if (orientation === 'vertical') {
    return (
      <div className={cn('flex flex-col items-center gap-2', className)} {...a11y}>
        <svg
          aria-hidden="true"
          viewBox={`0 0 12 ${total * 10}`}
          preserveAspectRatio="none"
          // `h-full` collapsed to the min-height inside a flex column; `flex-1` lets
          // the ladder actually fill the space its container reserves for it.
          className="min-h-24 w-3 flex-1"
        >
          {ticks.map((i) => {
            const done = i < filled
            const current = i === filled
            return (
              <g key={i}>
                <rect
                  x={done ? 0 : 3}
                  y={i * 10 + 4}
                  width={done ? 12 : 7}
                  height={2}
                  fill={done ? 'var(--verified)' : 'var(--muted)'}
                />
                {current && <rect x={0} y={i * 10 + 1} width={2} height={8} fill="var(--rubric)" />}
              </g>
            )
          })}
        </svg>
        {showFraction && (
          <span className="numeral text-xs text-secondary">{`${filled}/${total}`}</span>
        )}
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-2.5', className)} {...a11y}>
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${total * 10} 12`}
        preserveAspectRatio="none"
        className="h-3 min-w-0 flex-1"
      >
        {ticks.map((i) => {
          const done = i < filled
          return (
            <rect
              key={i}
              x={i * 10 + 1}
              y={done ? 0 : 5}
              width={8}
              height={done ? 12 : 7}
              fill={done ? 'var(--verified)' : 'var(--muted)'}
            />
          )
        })}
      </svg>
      {showFraction && (
        <span className="numeral shrink-0 text-xs text-secondary">{`${filled}/${total}`}</span>
      )}
    </div>
  )
}
