import { useId, useRef, type ChangeEvent } from 'react'
import { CircleStop, FileAudio, Mic, MonitorUp, RotateCcw, ShieldCheck, Upload } from 'lucide-react'
import { useAudioRecorder, type LocalAudioCapture } from '../hooks/useAudioRecorder'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

interface AudioRecorderPanelProps {
  /** Колонтитул панели — римская колонцифра ставится вызывающим экраном. */
  kicker?: string
  title?: string
  description?: string
  disabled?: boolean
  maxDurationSeconds?: number
  maxUploadBytes?: number
  onAudioReady?: (capture: LocalAudioCapture) => void
  onClear?: () => void
  allowSystemAudio?: boolean
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`
}

function recorderStatus(status: ReturnType<typeof useAudioRecorder>['status']) {
  if (status === 'requesting') return 'Ожидаем разрешение на запись…'
  if (status === 'recording') return 'Идёт запись. Пока ничего не сохранено.'
  if (status === 'processing') return 'Готовим локальное прослушивание…'
  if (status === 'ready') return 'Аудио готово к проверке.'
  if (status === 'error') return 'Запись требует внимания.'
  return 'Готово к работе. Запись никогда не начинается автоматически.'
}

export function AudioRecorderPanel({
  kicker = 'Запись голоса',
  title = 'Запишите свой ответ',
  description = 'Говорите естественно, затем прослушайте запись и проверьте формулировки.',
  disabled = false,
  maxDurationSeconds = 180,
  maxUploadBytes,
  onAudioReady,
  onClear,
  allowSystemAudio = false,
}: AudioRecorderPanelProps) {
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recorder = useAudioRecorder({ maxDurationSeconds, maxUploadBytes, onAudioReady })
  const busy = recorder.status === 'requesting' || recorder.status === 'processing'
  const isRecording = recorder.status === 'recording'

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file && recorder.importFile(file)) onClear?.()
    event.target.value = ''
  }

  function handleClear() {
    recorder.reset()
    onClear?.()
  }

  function startLive(source: 'microphone' | 'system_audio') {
    if (recorder.capture) onClear?.()
    if (source === 'microphone') void recorder.start()
    else void recorder.startSystemAudio()
  }

  return (
    <Card className="overflow-hidden" aria-busy={busy}>
      <div className="border-b border-border px-5 py-4 shadow-[0_1px_0_var(--paper-hi)]">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <p className="section-kicker">{kicker}</p>
            <h2 className="card-title">{title}</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-secondary">{description}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted">
            <ShieldCheck className="size-3.5 text-verified" aria-hidden="true" />
            Локальное прослушивание
          </span>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="rounded-[3px] bg-recess p-4 shadow-[var(--bevel-down)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`grid size-11 shrink-0 place-items-center rounded-[3px] border ${isRecording ? 'border-rubric/60 bg-rubric-soft text-rubric' : 'border-border bg-elevated text-secondary'}`}>
                <Mic className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span role="timer" aria-label={`Прошло времени записи: ${formatTime(recorder.elapsedSeconds)}`} className="numeral text-2xl font-bold text-primary">
                    {formatTime(recorder.elapsedSeconds)}
                  </span>
                  <span className="text-xs text-muted">
                    / <span className="numeral">{formatTime(maxDurationSeconds)}</span> макс.
                  </span>
                </div>
                <p aria-live="polite" aria-atomic="true" className="mt-0.5 text-xs leading-5 text-secondary">
                  {recorderStatus(recorder.status)}
                </p>
              </div>
            </div>

            {/*
              Гравированный уровень: двенадцать делений строкомера, а не свечение.
              Различие ФОРМОЙ — активное деление во всю высоту, спящее срезано снизу.
            */}
            <div
              role="meter"
              aria-label="Уровень входного сигнала микрофона"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={recorder.level}
              className="flex h-8 shrink-0 items-end gap-[3px]"
            >
              {Array.from({ length: 12 }, (_, index) => {
                const active = recorder.level >= (index + 1) * (100 / 12)
                return <span key={index} aria-hidden="true" className={`w-1.5 transition-colors motion-reduce:transition-none ${active ? 'bg-verified' : 'bg-border-strong'}`} style={{ height: active ? `${8 + index * 1.7}px` : `${Math.max(3, (8 + index * 1.7) * 0.45)}px` }} />
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {isRecording ? (
              <Button type="button" variant="danger" onClick={recorder.stop} disabled={disabled} className="sm:min-w-36">
                <CircleStop className="size-4" aria-hidden="true" /> Остановить запись
              </Button>
            ) : (
              <Button type="button" onClick={() => startLive('microphone')} disabled={disabled || busy || !recorder.isSupported} className="sm:min-w-36">
                <Mic className="size-4" aria-hidden="true" /> {recorder.status === 'requesting' ? 'Ожидаем разрешение…' : recorder.status === 'processing' ? 'Готовим аудио…' : 'Начать запись'}
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={disabled || isRecording || busy}>
              <Upload className="size-4" aria-hidden="true" /> Импортировать аудио
            </Button>
            {allowSystemAudio && <Button type="button" variant="secondary" onClick={() => startLive('system_audio')} disabled={disabled || isRecording || busy || !recorder.isSystemAudioSupported}>
              <MonitorUp className="size-4" aria-hidden="true" /> Записать системный звук
            </Button>}
            {recorder.capture && (
              <Button type="button" variant="ghost" onClick={handleClear} disabled={disabled || busy || isRecording}>
                <RotateCcw className="size-4" aria-hidden="true" /> Очистить дубль
              </Button>
            )}
            <input
              ref={fileInputRef}
              id={inputId}
              type="file"
              accept="audio/*,.m4a,.mp3,.wav,.ogg,.opus,.flac,.aac,.webm"
              className="sr-only"
              tabIndex={-1}
              onChange={handleFile}
              disabled={disabled || isRecording || busy}
              aria-label="Импортировать аудиофайл"
            />
          </div>
          {allowSystemAudio && <p className="mt-3 text-xs leading-5 text-muted"><MonitorUp className="mr-1.5 inline size-3.5" aria-hidden="true" />Запись системного звука начнётся только после выбора разрешённого источника в системном окне. Записывайте только тот материал, на запись которого у вас есть разрешение.</p>}
        </div>

        {/*
          КОНТРАКТ: пока ошибки нет, узла с role="alert" в дереве быть НЕ ДОЛЖНО.
          Пустой контейнер «ради стабильности лейаута» здесь запрещён —
          queryByRole('alert') обязан возвращать null.
        */}
        {!recorder.isSupported && !recorder.error && (
          <div role="status" className="relative rounded-[3px] bg-recess py-3 pl-4 pr-4 text-sm leading-6 text-amber shadow-[var(--bevel-down)]">
            <span aria-hidden="true" className="absolute inset-y-3 left-0 w-[2px] bg-amber" />
            Запись вживую не поддерживается в этой среде. Вы по-прежнему можете импортировать локальный аудиофайл.
          </div>
        )}

        {recorder.error && (
          <div role="alert" className="relative rounded-[3px] border border-amber/30 bg-amber/5 py-3 pl-4 pr-4 text-sm leading-6 text-amber">
            <span aria-hidden="true" className="absolute inset-y-3 left-0 w-[2px] bg-amber" />
            {recorder.error}
          </div>
        )}

        {recorder.capture && (
          <section aria-labelledby={`${inputId}-preview`} className="rounded-[2px] border border-border bg-elevated p-4 shadow-[var(--lift-2)]">
            <div className="flex items-start gap-3">
              <FileAudio className="mt-0.5 size-5 shrink-0 text-verified" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-baseline">
                  <h3 id={`${inputId}-preview`} className="text-sm font-semibold text-primary">
                    {recorder.capture.source === 'microphone' ? 'Записанный дубль' : recorder.capture.source === 'system_audio' ? 'Записанный системный звук' : recorder.capture.fileName || 'Импортированное аудио'}
                  </h3>
                  <span className="numeral text-xs text-muted">
                    {recorder.capture.durationSeconds > 0 ? formatTime(recorder.capture.durationSeconds) : 'Длительность загрузится при прослушивании'}
                  </span>
                </div>
                <audio
                  key={recorder.capture.url}
                  controls
                  preload="metadata"
                  src={recorder.capture.url}
                  onLoadedMetadata={(event) => recorder.updateDuration(event.currentTarget.duration, recorder.capture?.url)}
                  onError={() => recorder.handleMediaError(recorder.capture?.url)}
                  aria-label="Прослушивание аудиодубля"
                  className="mt-3 h-11 w-full"
                />
                <p className="mt-3 text-xs leading-5 text-secondary">
                  Оцените ясность, плавность речи и выбор выражений. Автоматической оценки произношения нет; дубль не считается подтверждением, пока вы явно его не сохраните.
                </p>
              </div>
            </div>
          </section>
        )}

        <p className="flex items-start gap-2 text-xs leading-5 text-muted">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Аудио остаётся только в локальном прослушивании. Текущее упражнение определяет, нужно ли и как его сохранить.
        </p>
      </div>
    </Card>
  )
}
