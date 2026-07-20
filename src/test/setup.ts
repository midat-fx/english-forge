import '@testing-library/jest-dom/vitest'
// Re-exported by @testing-library/react; importing @testing-library/dom directly
// fails under pnpm's strict node_modules, since it is only a transitive dependency.
import { configure } from '@testing-library/react'
import { beforeEach } from 'vitest'

// Testing Library waits 1s by default in findBy*/waitFor. Many route tests here
// render through the real, lazily-imported 1.1 MB lexical catalog, so that budget
// measures machine speed rather than behaviour: it passed consistently on an M-series
// laptop and failed on the Windows CI runner, where a red test blocks the release
// installers. Raised globally so the fix cannot be forgotten at a new call site.
configure({ asyncUtilTimeout: 15_000 })

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
}

const testStorage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: testStorage,
})
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: testStorage,
})

beforeEach(() => {
  testStorage.clear()
})
