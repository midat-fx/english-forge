import { useEffect, useState } from 'react'
import { loadLexicalCatalogLevel } from '../data/lexicalCatalogLoader'
import type { CatalogLevel, LexicalCatalogItem } from '../domain/lexicalCatalog'

export function useLexicalCatalogLevel(level: CatalogLevel) {
  const [items, setItems] = useState<readonly LexicalCatalogItem[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setItems(null)
    setError('')
    void loadLexicalCatalogLevel(level).then(
      (loaded) => { if (active) setItems(loaded) },
      (caught) => {
        if (active) setError(`Каталог ${level} не удалось открыть: ${caught instanceof Error ? caught.message : String(caught)}`)
      },
    )
    return () => { active = false }
  }, [level])

  return { items, error, loading: items === null && !error }
}
