import { cn } from '../../lib/utils'

/**
 * Корректурная правка — a word-level diff set the way a proofreader marks one.
 *
 * COLOUR-BLIND SAFETY IS A REQUIREMENT HERE, NOT A NICETY. --rubric (L≈0.295)
 * and --verified (L≈0.440) become two greys of similar lightness under
 * deuteranopia, and lightness alone is not enough to tell "wrong" from "right".
 * So the two sides differ by SHAPE: the removed token is struck through, the
 * accepted token is underlined. Both sides are also labelled in words by the
 * caller.
 */

/** Word-level LCS diff. Pure, dependency-free. */
function diffWords(before: string, after: string) {
  const a = before.split(/(\s+)/).filter((t) => t.length > 0)
  const b = after.split(/(\s+)/).filter((t) => t.length > 0)
  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  const removed: boolean[] = new Array(a.length).fill(false)
  const added: boolean[] = new Array(b.length).fill(false)
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1
      j += 1
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      removed[i] = true
      i += 1
    } else {
      added[j] = true
      j += 1
    }
  }
  while (i < a.length) { removed[i] = true; i += 1 }
  while (j < b.length) { added[j] = true; j += 1 }
  return { a, b, removed, added }
}

interface DiffProps {
  before: string
  after: string
  className?: string
}

export function Diff({ before, after, className }: DiffProps) {
  const { a, b, removed, added } = diffWords(before, after)
  return (
    <div className={cn('space-y-2', className)}>
      {/* Semantic <del>/<ins> rather than styled spans: strike-through and underline
          are invisible to a screen reader, which would otherwise read two unlabelled
          English sentences in a row and announce the wrong one as ordinary prose. */}
      <p lang="en" className="reading-en text-base text-secondary">
        <span className="sr-only" lang="ru">Было: </span>
        {a.map((token, index) => (removed[index] ? (
          <del
            key={`a-${index}`}
            className="text-muted [text-decoration-color:var(--rubric)] [text-decoration-thickness:1px]"
          >
            {token}
          </del>
        ) : (
          <span key={`a-${index}`}>{token}</span>
        )))}
      </p>
      <p lang="en" className="reading-en text-base text-primary">
        <span className="sr-only" lang="ru">Стало: </span>
        {b.map((token, index) => (added[index] ? (
          <ins key={`b-${index}`} className="text-teal-strong [text-underline-offset:3px]">
            {token}
          </ins>
        ) : (
          <span key={`b-${index}`}>{token}</span>
        )))}
      </p>
    </div>
  )
}
