import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

/**
 * Оглавление выпуска — a table of contents with dot leaders.
 *
 * This is the object that replaces "six identical rounded boxes": a route, a
 * funnel, a metric table and a step list are all the same shape — an ordered
 * list of named things with a value on the right — and typesetting has had a
 * good answer for that for five hundred years.
 *
 * Contents NEVER replaces quantitative feedback: "how much is left" is read at
 * a glance from a <Rule>, not by scanning a list. Every Contents ships with a
 * Rule in its heading.
 */
export interface ContentsItem {
  id: string
  /** Folio: roman numeral or index, set on the left margin. */
  folio: string
  title: ReactNode
  /** Right-hand value: minutes, a count, or a check mark. */
  value?: ReactNode
  state?: 'done' | 'current' | 'future'
  to?: string
  onSelect?: () => void
}

function Row({ item }: { item: ContentsItem }) {
  const state = item.state ?? 'future'
  const inner = (
    <>
      {/* min-width:0 on the title is what lets the leader actually stretch. */}
      <span
        className={cn(
          'numeral w-[2ch] flex-none text-right text-xs',
          state === 'done'
            ? 'text-muted line-through decoration-2 [text-decoration-color:var(--verified)]'
            : state === 'current' ? 'text-rubric' : 'text-muted',
        )}
      >
        {item.folio}
        {state === 'current' && <span className="sr-only">, текущий шаг</span>}
      </span>
      <span
        className={cn(
          'min-w-0 text-base font-medium',
          state === 'future' ? 'text-muted' : 'text-primary',
        )}
      >
        {item.title}
      </span>
      <span
        aria-hidden="true"
        className="hidden flex-1 basis-8 border-b border-dotted border-border-strong transition-colors group-hover:border-muted sm:block"
        style={{ transform: 'translateY(-0.28em)', minWidth: '1.5rem' }}
      />
      {item.value !== undefined && (
        <span className="numeral flex-none whitespace-nowrap text-sm text-secondary">{item.value}</span>
      )}
    </>
  )

  // Hover-отклик — обещание клика. Строка без `to`/`onSelect` статична: иначе
  // оглавление, которое просто печатает величины, подсвечивается как ссылка.
  const interactive = Boolean(item.to || item.onSelect)
  const rowClass = cn(
    'group relative flex min-h-11 flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[3px] px-3 sm:flex-nowrap',
    interactive && 'transition-[background-color,transform] hover:bg-elevated hover:-translate-y-px',
  )

  return (
    <li className="relative">
      {/* The current step is the only row carrying a rubric bracket on the margin. */}
      {state === 'current' && (
        <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-[2px] bg-rubric" />
      )}
      {item.to ? (
        <Link to={item.to} className={rowClass} onClick={item.onSelect}>
          {inner}
        </Link>
      ) : (
        <div className={rowClass}>{inner}</div>
      )}
    </li>
  )
}

export function Contents({ items, className }: { items: ContentsItem[]; className?: string }) {
  return (
    <ol className={cn('space-y-0.5', className)}>
      {items.map((item) => (
        <Row key={item.id} item={item} />
      ))}
    </ol>
  )
}
