import { Component, createRef, type ChangeEvent, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCcw, Upload } from 'lucide-react'
import { replacePersistedProfile } from '../data/profileStorage'
import { MAX_IMPORT_BYTES, parseForgeJson } from '../data/serialization'
import { assertProfileRecordingsAvailable } from '../lib/audioStorage'
import { discardProfileThenPurgeMedia } from '../lib/profileDeletion'
import { Button } from './ui/Button'
import { Card, CardBody } from './ui/Card'
import { MarginNote } from './ui/MarginNote'

interface Props { children: ReactNode }
interface State { failed: boolean; recoveryMessage: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, recoveryMessage: '' }
  private fileInput = createRef<HTMLInputElement>()

  static getDerivedStateFromError(): State {
    return { failed: true, recoveryMessage: '' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('English Forge failed safely:', error, info.componentStack)
  }

  private async startOver() {
    if (!window.confirm('Удалить локальный профиль и начать заново с диагностики? Без резервной копии это действие нельзя отменить.')) return
    try {
      const deletion = await discardProfileThenPurgeMedia()
      if (deletion.mediaCleanupError) console.warn('Profile was deleted; orphan audio cleanup will be retried after restart.', deletion.mediaCleanupError)
      window.location.reload()
    } catch (error) {
      this.setState({ recoveryMessage: error instanceof Error ? error.message : 'Не удалось восстановить профиль.' })
    }
  }

  private async importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('Импорт превышает безопасный лимит профиля 9 МБ.')
      const data = parseForgeJson(await file.text())
      await assertProfileRecordingsAvailable(data)
      await replacePersistedProfile(data)
      window.location.reload()
    } catch (error) {
      this.setState({ recoveryMessage: error instanceof Error ? error.message : 'Не удалось импортировать резервную копию.' })
      event.target.value = ''
    }
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <main className="grid min-h-screen place-items-center bg-canvas p-6 text-primary">
        <Card level="leaf" className="sheet-in w-full max-w-xl">
          <CardBody className="p-6 sm:p-8">
            <div className="flex items-baseline justify-between gap-4">
              <p className="section-kicker">Безопасное восстановление</p>
              <AlertTriangle className="size-4 shrink-0 self-center text-rubric" aria-hidden="true" />
            </div>
            <div className="rule-double mt-3" />

            <h1 className="mt-6 text-h2 font-light tracking-[-0.02em]">English Forge столкнулся с неожиданной ошибкой.</h1>
            <p className="mt-3 max-w-[62ch] text-sm leading-6 text-secondary">
              Сначала перезапустите приложение. Если ошибка повторится, импортируйте проверенную JSON-копию или удалите повреждённый профиль и начните с диагностики.
            </p>

            {this.state.recoveryMessage && (
              <Card level="recess" className="mt-5 px-4 py-3 text-sm text-rubric" role="alert">{this.state.recoveryMessage}</Card>
            )}

            <label htmlFor="recovery-backup-file" className="sr-only">Резервная копия профиля JSON</label>
            <input id="recovery-backup-file" ref={this.fileInput} className="sr-only" tabIndex={-1} type="file" accept="application/json,.json" onChange={(event) => void this.importBackup(event)} />

            <div className="mt-6 flex flex-wrap gap-2">
              <Button type="button" onClick={() => window.location.reload()}><RefreshCcw className="size-4" aria-hidden="true" /> Перезапустить</Button>
              <Button type="button" variant="secondary" onClick={() => this.fileInput.current?.click()}><Upload className="size-4" aria-hidden="true" /> Импортировать копию</Button>
              <Button type="button" variant="ghost" className="text-rubric" onClick={() => void this.startOver()}>Удалить профиль</Button>
            </div>

            <MarginNote className="mt-5 xl:max-w-none xl:[transform:none]">Локальные данные не переписываются, пока вы не выберете действие.</MarginNote>
          </CardBody>
        </Card>
      </main>
    )
  }
}
