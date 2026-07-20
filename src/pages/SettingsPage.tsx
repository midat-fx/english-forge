import { useId, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import { Check, Database, Download, Eye, FileJson, HardDrive, Keyboard, LockKeyhole, Pencil, Plus, RefreshCcw, Trash2, Upload, Users, X } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { Input, Select } from '../components/ui/Field'
import { MarginNote } from '../components/ui/MarginNote'
import { exportJson, exportPhrasesCsv, MAX_IMPORT_BYTES, parseForgeJson } from '../data/serialization'
import type { ForgeData, Preferences } from '../domain/types'
import { openJsonText, saveTextFile } from '../lib/desktopFiles'
import { deleteRecording, referencedRecordingIds } from '../lib/audioStorage'
import { getProfilesSnapshot, subscribeProfiles } from '../data/profileStorage'
import { cn } from '../lib/utils'
import { useForgeStore } from '../store/useForgeStore'

export function SettingsPage() {
  const store = useForgeStore()
  const update = useForgeStore((state) => state.updatePreferences)
  const importProfile = useForgeStore((state) => state.importProfile)
  const resetToDemo = useForgeStore((state) => state.resetToDemo)
  const clearAll = useForgeStore((state) => state.clearAll)
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ForgeData>()
  const [importError, setImportError] = useState('')
  const [message, setMessage] = useState('')
  const data: ForgeData = { schemaVersion: store.schemaVersion, dailyVocabularyAssignment: store.dailyVocabularyAssignment, dailyVocabularyAssignments: store.dailyVocabularyAssignments, phrases: store.phrases, skillStates: store.skillStates, reviews: store.reviews, errors: store.errors, missions: store.missions, speakingAttempts: store.speakingAttempts, listeningClips: store.listeningClips, listeningAttempts: store.listeningAttempts, placementAttempts: store.placementAttempts, grammarProgress: store.grammarProgress, preferences: store.preferences }

  async function readImport(file?: File) {
    if (!file) return
    setImportError('')
    setPreview(undefined)
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('Файл больше 9 МБ — такой импорт не поддерживается.')
      setPreview(parseForgeJson(await file.text()))
    } catch (error) { setImportError(error instanceof Error ? error.message : 'Импорт не удался.') }
  }

  async function chooseImport() {
    setImportError('')
    setMessage('')
    try {
      const text = await openJsonText()
      if (text === undefined) fileRef.current?.click()
      else if (text !== null) setPreview(parseForgeJson(text))
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Импорт не удался.')
    }
  }

  async function saveExport(kind: 'json' | 'csv') {
    setImportError('')
    setMessage('')
    const date = new Date().toISOString().slice(0, 10)
    const isJson = kind === 'json'
    try {
      const saved = await saveTextFile(
        isJson ? `english-forge-${date}.json` : `english-forge-phrases-${date}.csv`,
        isJson ? exportJson(data) : exportPhrasesCsv(data),
        isJson ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8',
        [{ name: isJson ? 'English Forge JSON' : 'Phrase Bank CSV', extensions: [kind] }],
      )
      if (saved) setMessage(`${isJson ? 'Профиль' : 'Личный словарь'} успешно экспортирован.`)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Экспорт не удался.')
    }
  }

  async function performImport() {
    if (!preview) return
    setImportError('')
    try {
      const previousRecordingIds = referencedRecordingIds(data)
      const importedRecordingIds = new Set(referencedRecordingIds(preview))
      await importProfile(preview)
      const cleanup = await Promise.allSettled(previousRecordingIds.filter((id) => !importedRecordingIds.has(id)).map((id) => deleteRecording(id)))
      const failed = cleanup.filter((result) => result.status === 'rejected').length
      setMessage(`Импортировано: ${preview.phrases.length} выражений и ${preview.reviews.length} повторений.${failed ? ` Не удалось очистить аудиофайлов: ${failed}; приложение повторит при запуске.` : ' Заменённые аудиофайлы очищены.'}`)
      setPreview(undefined)
      if (fileRef.current) fileRef.current.value = ''
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Не удалось сохранить импорт. Текущие данные не изменены.')
    }
  }

  async function replaceProfileAndClearAudio(mode: 'demo' | 'empty') {
    setImportError('')
    const recordingIds = referencedRecordingIds(data)
    try {
      if (mode === 'demo') await resetToDemo()
      else await clearAll()
      const cleanup = await Promise.allSettled(recordingIds.map((id) => deleteRecording(id)))
      const failed = cleanup.filter((result) => result.status === 'rejected').length
      setMessage(`${mode === 'demo' ? 'Демо-профиль восстановлен.' : 'Данные профиля удалены.'}${failed ? ` Не удалось удалить аудиофайлов: ${failed}; очистка повторится при запуске.` : ' Связанные аудиозаписи удалены.'}`)
    } catch (error) { setImportError(error instanceof Error ? error.message : 'Не удалось заменить профиль; существующие данные и аудио не изменены.') }
  }

  return <div className="mx-auto max-w-5xl">
    {/* КОЛОНТИТУЛ */}
    <p className="section-kicker">Настройки</p>
    <div className="rule-double mt-3" />

    <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.82fr]">
      <div className="space-y-6">
        <ProfilesSection />

        <Sheet folio="II" title="Учебный план" description="Сколько заниматься каждый день.">
          <Card level="recess" className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="inspector-label">Текущий маршрут</p>
              <p className="mt-1.5 text-sm text-primary">Рабочий <span className="numeral">{store.preferences.currentLevel}</span> → цель <span className="numeral">{store.preferences.targetLevel}</span></p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link to="/diagnostics" lang="en" className="reading-en ink-underline text-sm font-semibold text-teal">Listening / speaking / writing</Link>
              <Link to="/level-test" className="ink-underline text-sm font-semibold text-teal">Пройти тест заново</Link>
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <NumberSetting id="daily-minutes" label="Минут на повторения в день" value={store.preferences.dailyMinutes} min={5} max={90} onChange={(dailyMinutes) => update({ dailyMinutes })} />
            <NumberSetting id="daily-new-words" label="Новых слов в день" value={store.preferences.dailyNewWords ?? 10} min={1} max={30} onChange={(dailyNewWords) => update({ dailyNewWords })} />
            <NumberSetting id="max-new-phrases" label="Максимум новых слов в повторения за день" value={store.preferences.maxNewPhrases} min={0} max={10} onChange={(maxNewPhrases) => update({ maxNewPhrases })} />
          </div>

          <MarginNote className="xl:max-w-none xl:[transform:none]">Это верхний предел: если повторений накопилось много, приложение само придержит новые слова.</MarginNote>

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectSetting id="english-variant" label="Вариант английского" value={store.preferences.englishVariant} onChange={(value) => update({ englishVariant: value as Preferences['englishVariant'] })}>
              <option>International</option><option>UK</option><option>US</option>
            </SelectSetting>
            <SelectSetting id="explanation-language" label="Язык объяснений" value={store.preferences.explanationLanguage} onChange={(value) => update({ explanationLanguage: value as Preferences['explanationLanguage'] })}>
              <option value="Russian">Русский + английский</option><option value="English">Только английский</option>
            </SelectSetting>
          </div>
        </Sheet>

        <Sheet folio="III" icon={<Eye className="size-4" />} title="Вид и доступность" description="Тема и движение интерфейса.">
          {/* Сегмент клавиш с детентом: выбранная утоплена и несёт рубричную скобу. */}
          <Segment
            legend="Тема"
            value={store.preferences.theme}
            options={[{ value: 'dark', label: 'Тёмная' }, { value: 'light', label: 'Светлая' }, { value: 'system', label: 'Системная' }]}
            onChange={(value) => update({ theme: value as Preferences['theme'] })}
          />
          <Segment
            legend="Уменьшить движение"
            value={store.preferences.reducedMotion ? 'on' : 'off'}
            options={[{ value: 'off', label: 'Обычное' }, { value: 'on', label: 'Уменьшенное' }]}
            onChange={(value) => update({ reducedMotion: value === 'on' })}
          />
        </Sheet>

        <Sheet folio="IV" icon={<Keyboard className="size-4" />} title="Горячие клавиши" description="Главные действия доступны без поиска в меню.">
          <dl className="grid gap-px overflow-hidden rounded-[3px] bg-border sm:grid-cols-2">
            {[['Добавить слово', '⌘ N'], ['Проверить ответ', '⌘ Enter'], ['Подсказка в практике', 'H'], ['Оценить ответ', '1–4'], ['На экран «Сегодня»', 'G, затем D'], ['Слова и выражения', 'G, затем W'], ['Грамматика', 'G, затем A'], ['Слушать и говорить', 'G, затем V']].map(([label, key]) => (
              <div key={label} className="flex items-center justify-between gap-3 bg-surface px-3.5 py-3 text-sm">
                <dt className="text-secondary">{label}</dt>
                <dd><kbd>{key}</kbd></dd>
              </div>
            ))}
          </dl>
        </Sheet>
      </div>

      <div className="space-y-6">
        <Sheet folio="V" icon={<LockKeyhole className="size-4" />} title="Приватность" description="Ваши данные никуда не отправляются.">
          <p className="text-xs leading-5 text-secondary">Слова, ответы и записи голоса хранятся в вашем профиле, пока вы их не удалите — в разделе «Слушать и говорить» или сбросом профиля.</p>
        </Sheet>

        <Sheet folio="VI" icon={<Database className="size-4" />} title="Резервная копия" description="Сохраните прогресс в файл или восстановите его из файла.">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => void saveExport('json')}><FileJson className="size-4" aria-hidden="true" /> Экспорт JSON</Button>
            <Button variant="secondary" onClick={() => void saveExport('csv')}><Download className="size-4" aria-hidden="true" /> Экспорт CSV</Button>
          </div>

          <Card level="recess" className="border-l-2 border-l-amber px-4 py-3 text-xs leading-5 text-secondary">
            <strong className="text-amber">Записи голоса в копию не входят</strong> — сохраняется текст и прогресс.
          </Card>

          <label htmlFor="settings-profile-import" className="sr-only">Резервная копия профиля JSON</label>
          <input id="settings-profile-import" ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} onChange={(event) => void readImport(event.target.files?.[0])} />
          <Button variant="secondary" className="w-full" onClick={() => void chooseImport()}><Upload className="size-4" aria-hidden="true" /> Импорт JSON English Forge</Button>

          {importError && <p role="alert" className="text-sm text-rubric">{importError}</p>}

          {preview && (
            <Card level="slip" className="p-4">
              <p className="section-kicker">Предпросмотр импорта</p>
              <div className="rule-double mt-2.5" />
              <p className="numeral mt-3 text-xs leading-5 text-secondary">{preview.phrases.length} выражений · {preview.reviews.length} повторений · {preview.speakingAttempts.length} устных попыток · {preview.listeningAttempts.length} попыток аудирования · {preview.errors.length} ошибок · {preview.missions.length} заданий</p>
              <p className="mt-2 text-xs leading-5 text-muted">Текущий профиль будет заменён после подтверждения.</p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => void performImport()}>Подтвердить импорт</Button>
                <Button size="sm" variant="ghost" onClick={() => setPreview(undefined)}>Отмена</Button>
              </div>
            </Card>
          )}

          {message && <p aria-live="polite" className="text-xs text-verified">{message}</p>}

          <Card level="recess" className="flex items-center gap-3 px-4 py-3">
            <HardDrive className="size-5 shrink-0 text-teal" aria-hidden="true" />
            <div>
              <p className="numeral text-sm text-primary">Профиль, версия {store.schemaVersion}</p>
              <p className="numeral mt-1 text-xs text-muted">{store.phrases.length} выражений · {store.reviews.length} повторений · {store.speakingAttempts.length} устных попыток · {store.listeningAttempts.length} попыток аудирования</p>
            </div>
          </Card>
        </Sheet>

        <Sheet folio="VII" icon={<Trash2 className="size-4" />} title="Сброс профиля" description="Опасная зона" danger>
          <p className="text-xs leading-5 text-muted">Сначала сделайте резервную копию, если история занятий может ещё пригодиться. При сбросе удаляются и записи голоса.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => { if (window.confirm('Восстановить демо-профиль? Текущие данные и записи голоса будут удалены.')) void replaceProfileAndClearAudio('demo') }}><RefreshCcw className="size-4" aria-hidden="true" /> Восстановить демо</Button>
            <Button variant="danger" onClick={() => { if (window.confirm('Удалить все слова, повторения, записи и задания? Это действие необратимо.')) void replaceProfileAndClearAudio('empty') }}><Trash2 className="size-4" aria-hidden="true" /> Удалить все данные</Button>
          </div>
        </Sheet>
      </div>
    </div>
  </div>
}

function ProfilesSection() {
  const registry = useSyncExternalStore(subscribeProfiles, getProfilesSnapshot, getProfilesSnapshot)
  const createProfile = useForgeStore((state) => state.createProfile)
  const switchProfile = useForgeStore((state) => state.switchProfile)
  const renameProfile = useForgeStore((state) => state.renameProfile)
  const deleteProfile = useForgeStore((state) => state.deleteProfile)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  function addProfile(event: FormEvent) {
    event.preventDefault()
    if (!newName.trim()) return
    if (!window.confirm(`Создать профиль «${newName.trim()}» и перейти к его диагностике уровня? Ваш текущий профиль сохранится — к нему можно вернуться через переключатель профиля.`)) return
    void createProfile(newName.trim())
    setNewName('')
  }
  function submitRename(event: FormEvent) {
    event.preventDefault()
    if (editingId && editName.trim()) void renameProfile(editingId, editName.trim())
    setEditingId(null)
  }

  return <Sheet folio="I" icon={<Users className="size-4" />} title="Профили" description="Несколько учащихся на одном приложении — у каждого свой уровень и прогресс.">
    <div className="space-y-2">
      {registry.profiles.map((profile) => {
        const active = profile.id === registry.activeId
        return <Card key={profile.id} level="slip" className="flex flex-wrap items-center gap-3 p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[2px] bg-recess text-sm font-bold text-primary shadow-[var(--bevel-down)]">{profile.name.trim().charAt(0).toUpperCase() || '•'}</span>
          {editingId === profile.id
            ? <form onSubmit={submitRename} className="flex min-w-0 flex-1 gap-2"><Input aria-label="Новое имя профиля" value={editName} autoFocus maxLength={40} onChange={(event) => setEditName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setEditingId(null) }} className="h-11" /><Button type="submit" size="sm" aria-label="Сохранить имя"><Check className="size-4" /></Button><Button type="button" size="sm" variant="ghost" aria-label="Отменить переименование" onClick={() => setEditingId(null)}><X className="size-4" /></Button></form>
            : <div className="min-w-0 flex-1"><p className="flex items-center gap-2 truncate text-sm font-semibold text-primary">{profile.name}{active && <Badge tone="ember">Активный</Badge>}</p><p className="mt-1 text-xs text-muted">{profile.placementCompleted ? `Уровень ${profile.level}` : 'Диагностика не пройдена'}</p></div>}
          <div className="flex items-center gap-1">
            {!active && <Button size="sm" variant="secondary" onClick={() => void switchProfile(profile.id)}>Выбрать</Button>}
            <button type="button" aria-label={`Переименовать профиль ${profile.name}`} className="detent grid size-11 place-items-center rounded-[3px] text-muted hover:bg-surface hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" onClick={() => { setEditingId(profile.id); setEditName(profile.name) }}><Pencil className="size-4" /></button>
            <button type="button" aria-label={`Удалить профиль ${profile.name}`} title={registry.profiles.length <= 1 ? 'Нельзя удалить единственный профиль' : `Удалить профиль ${profile.name}`} disabled={registry.profiles.length <= 1} className="detent grid size-11 place-items-center rounded-[3px] text-muted hover:bg-rubric-soft hover:text-rubric focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40" onClick={() => { if (window.confirm(`Удалить профиль «${profile.name}» и весь его прогресс (включая аудиозаписи)? Это действие необратимо.`)) void deleteProfile(profile.id) }}><Trash2 className="size-4" /></button>
          </div>
        </Card>
      })}
    </div>
    <form onSubmit={addProfile} className="flex flex-col gap-2 sm:flex-row"><Input aria-label="Имя нового профиля" value={newName} maxLength={40} placeholder="Имя нового профиля" onChange={(event) => setNewName(event.target.value)} /><Button type="submit" variant="ember" disabled={!newName.trim()} className="shrink-0"><Plus className="size-4" /> Добавить профиль</Button></form>
  </Sheet>
}

/**
 * Лист настроек. Каркас общей страницы контента: колонцифра + колонтитул,
 * двойная линейка, содержание. Иконка — служебная метка на поле, а не
 * бирюзовая плитка 40×40 в каждом заголовке.
 */
function Sheet({ folio, icon, title, description, danger, children }: { folio?: string; icon?: ReactNode; title: string; description: string; danger?: boolean; children: ReactNode }) {
  return (
    <Card level="leaf">
      <CardBody className="p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-2.5">
            {folio && <span className="numeral text-xs text-rubric">{folio}</span>}
            <h2 className={cn('text-h3 font-semibold', danger ? 'text-rubric' : 'text-primary')}>{title}</h2>
          </div>
          {icon && <span className="shrink-0 self-center text-muted" aria-hidden="true">{icon}</span>}
        </div>
        <p className="mt-1.5 text-xs leading-5 text-muted">{description}</p>
        <div className="rule-double mt-3.5" />
        <div className="mt-5 space-y-4">{children}</div>
      </CardBody>
    </Card>
  )
}

function NumberSetting({ id, label, value, min, max, onChange }: { id: string; label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <div>
      <label htmlFor={id} className="inspector-label block">{label}</label>
      <Input id={id} type="number" min={min} max={max} value={value} className="numeral mt-2" onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value))))} />
    </div>
  )
}

function SelectSetting({ id, label, value, onChange, children }: { id: string; label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="inspector-label block">{label}</label>
      <Select id={id} className="mt-2" value={value} onChange={(event) => onChange(event.target.value)}>{children}</Select>
    </div>
  )
}

/**
 * Сегмент клавиш с детентом. Выбранная клавиша УТОПЛЕНА (var(--press)) и несёт
 * рубричную скобу слева — состояние читается формой и глубиной, а не только
 * цветом. `aria-pressed` на каждой клавише, группа названа через `role="group"`.
 */
function Segment({ legend, value, options, onChange }: { legend: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const labelId = useId()
  return (
    <div>
      <p className="inspector-label" id={labelId}>{legend}</p>
      <div role="group" aria-labelledby={labelId} className="mt-2 flex gap-px overflow-hidden rounded-[3px] bg-border">
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                'detent relative min-h-11 flex-1 px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                selected
                  ? 'bg-recess text-primary shadow-[var(--press)]'
                  : 'bg-elevated text-secondary shadow-[var(--bevel-up)] hover:text-primary',
              )}
            >
              {selected && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-[3px] bg-rubric" />}
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
