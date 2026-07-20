import { useRef, useState, useSyncExternalStore, type ChangeEvent, type ReactNode } from 'react'
import { AlertTriangle, DatabaseBackup, Trash2, Upload } from 'lucide-react'
import { getLastStorageError, getProfileAccess, replacePersistedProfile, subscribeProfileAccess } from '../data/profileStorage'
import { MAX_IMPORT_BYTES, parseForgeJson } from '../data/serialization'
import { assertProfileRecordingsAvailable } from '../lib/audioStorage'
import { discardProfileThenPurgeMedia } from '../lib/profileDeletion'
import { localizeStorageError } from '../lib/storageMessages'
import { Button } from './ui/Button'
import { Card, CardBody } from './ui/Card'
import { MarginNote } from './ui/MarginNote'

/**
 * Гейт профиля. Два экрана, каждый — отдельный компонент: пока они были двумя
 * однострочными JSX-стенами, ни прочитать, ни отредактировать их было нельзя.
 *
 * Дети РАЗМОНТИРОВАНЫ, а не скрыты, пока профиль не прочитан: пока гидратация
 * не завершилась, ни один мутирующий контрол не должен существовать в дереве.
 */
export function ProfileGate({ children }: { children: ReactNode }) {
  const access = useSyncExternalStore(subscribeProfileAccess, getProfileAccess, getProfileAccess)

  if (access === 'loading') return <ProfileLoadingSheet />
  if (access === 'recovery') return <ProfileRecoverySheet />
  return children
}

/**
 * Ожидание чтения профиля. Ноль движения: вертушка — бесконечная анимация,
 * а бесконечных анимаций в приложении нет. Ожидание показано ПРЕДМЕТОМ —
 * пустая врезка под строкой набора, — а не крутящимся индикатором.
 */
function ProfileLoadingSheet() {
  return (
    <main className="grid min-h-screen min-h-dvh place-items-center bg-canvas p-6 text-primary">
      <div role="status" aria-live="polite" className="sheet-in w-full max-w-md text-center">
        <p className="section-kicker">English Forge</p>
        <div className="rule-double mt-3" />
        <Card level="recess" className="mx-auto mt-6 flex h-2 w-40 items-center" aria-hidden="true" />
        <h1 className="mt-6 text-h2 font-light tracking-[-0.02em]">Открываем локальный профиль…</h1>
        <p className="mt-3 text-sm leading-6 text-secondary">Практика станет доступна после проверки целостности данных.</p>
      </div>
    </main>
  )
}

/** Профиль не читается. Лист восстановления: ничего не переписываем без команды. */
function ProfileRecoverySheet() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('Резервная копия слишком велика: максимум 9 МБ.')
      const profile = parseForgeJson(await file.text())
      await assertProfileRecordingsAvailable(profile)
      await replacePersistedProfile(profile)
      window.location.reload()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось импортировать резервную копию.')
      event.target.value = ''
    }
  }

  async function discard() {
    if (!window.confirm('Удалить нечитаемый локальный профиль и начать заново с диагностики? Без резервной копии это действие нельзя отменить.')) return
    try {
      const deletion = await discardProfileThenPurgeMedia()
      if (deletion.mediaCleanupError) console.warn('Profile was deleted; orphan audio cleanup will be retried after restart.', deletion.mediaCleanupError)
      window.location.reload()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось восстановить профиль.')
    }
  }

  return (
    <main className="grid min-h-screen min-h-dvh place-items-center bg-canvas p-6 text-primary">
      <Card level="leaf" className="sheet-in w-full max-w-xl">
        <CardBody className="p-6 sm:p-8">
          <div className="flex items-baseline justify-between gap-4">
            <p className="section-kicker">Безопасное восстановление</p>
            <AlertTriangle className="size-4 shrink-0 self-center text-rubric" aria-hidden="true" />
          </div>
          <div className="rule-double mt-3" />

          <h1 className="mt-6 text-h2 font-light tracking-[-0.02em]">Исходный профиль сохранён без изменений.</h1>
          <p className="mt-3 max-w-[62ch] text-sm leading-6 text-secondary">
            English Forge заблокировал запись, чтобы не повредить данные. Импортируйте проверенную резервную копию или явно удалите нечитаемый профиль.
          </p>

          <Card level="recess" className="mt-5 break-words px-4 py-3 text-xs leading-5 text-muted">
            {localizeStorageError(getLastStorageError())}
          </Card>

          {message && <p role="alert" className="mt-3 text-sm text-rubric">{message}</p>}

          <input
            ref={inputRef}
            aria-label="Выбрать резервную копию профиля"
            className="sr-only"
            tabIndex={-1}
            type="file"
            accept="application/json,.json"
            onChange={(event) => void importBackup(event)}
          />

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="button" onClick={() => inputRef.current?.click()}>
              <Upload className="size-4" aria-hidden="true" /> Импортировать копию
            </Button>
            <Button type="button" variant="secondary" className="text-rubric" onClick={() => void discard()}>
              <Trash2 className="size-4" aria-hidden="true" /> Удалить профиль
            </Button>
          </div>

          <MarginNote className="mt-5 flex items-center gap-2 xl:max-w-none xl:[transform:none]">
            <DatabaseBackup className="size-4 shrink-0" aria-hidden="true" /> Во время восстановления данные не изменяются.
          </MarginNote>
        </CardBody>
      </Card>
    </main>
  )
}
