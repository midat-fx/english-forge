import { useCallback, useEffect, useRef, useState } from 'react'

export type AudioRecorderStatus = 'idle' | 'requesting' | 'recording' | 'processing' | 'ready' | 'error'

export interface LocalAudioCapture {
  blob: Blob
  url: string
  mimeType: string
  durationSeconds: number
  source: 'microphone' | 'system_audio' | 'import'
  fileName?: string
}

interface UseAudioRecorderOptions {
  maxDurationSeconds?: number
  maxUploadBytes?: number
  onAudioReady?: (capture: LocalAudioCapture) => void
}

const DEFAULT_MAX_DURATION_SECONDS = 180
export const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024
const MIME_PREFERENCES = [
  'audio/webm;codecs=opus',
  'audio/mp4',
  'audio/webm',
]

function formatRecorderError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'Доступ к микрофону запрещён. Разрешите его в системных настройках или импортируйте аудиофайл.'
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'Микрофон не найден. Подключите его или импортируйте аудиофайл.'
    }
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return 'Микрофон занят или недоступен. Закройте другие аудиоприложения и попробуйте снова.'
    }
  }
  return 'Не удалось запустить микрофон. Вы всё ещё можете импортировать аудиофайл.'
}

function selectMimeType() {
  if (typeof MediaRecorder.isTypeSupported !== 'function') return undefined
  return MIME_PREFERENCES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType))
}

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

export function useAudioRecorder({
  maxDurationSeconds = DEFAULT_MAX_DURATION_SECONDS,
  maxUploadBytes = DEFAULT_MAX_UPLOAD_BYTES,
  onAudioReady,
}: UseAudioRecorderOptions = {}) {
  const isSupported = typeof window !== 'undefined'
    && typeof window.MediaRecorder !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia)
  const isSystemAudioSupported = typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia)
  const [status, setStatus] = useState<AudioRecorderStatus>('idle')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string>()
  const [capture, setCapture] = useState<LocalAudioCapture>()
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const captureUrlRef = useRef<string | undefined>(undefined)
  const captureRef = useRef<LocalAudioCapture | undefined>(undefined)
  const captureSourceRef = useRef<LocalAudioCapture['source']>('microphone')
  const onAudioReadyRef = useRef(onAudioReady)
  const mountedRef = useRef(true)

  useEffect(() => {
    onAudioReadyRef.current = onAudioReady
  }, [onAudioReady])

  const clearTimerAndMeter = useCallback(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current)
    intervalRef.current = null
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = null
    setLevel(0)
    const audioContext = audioContextRef.current
    audioContextRef.current = null
    if (audioContext && audioContext.state !== 'closed') void audioContext.close()
  }, [])

  const releaseStream = useCallback(() => {
    stopTracks(streamRef.current)
    streamRef.current = null
  }, [])

  const replaceCapture = useCallback((next?: LocalAudioCapture) => {
    const previousUrl = captureUrlRef.current
    if (previousUrl && previousUrl !== next?.url) URL.revokeObjectURL(previousUrl)
    captureUrlRef.current = next?.url
    captureRef.current = next
    setCapture(next)
  }, [])

  const rejectImportedCapture = useCallback((message: string, expectedUrl?: string) => {
    const current = captureRef.current
    if (!current || current.source !== 'import' || (expectedUrl && current.url !== expectedUrl)) return
    replaceCapture(undefined)
    setElapsedSeconds(0)
    setStatus('error')
    setError(message)
  }, [replaceCapture])

  const finishRecording = useCallback((recorder: MediaRecorder) => {
    clearTimerAndMeter()
    releaseStream()
    if (!mountedRef.current) return

    const elapsedMilliseconds = performance.now() - startedAtRef.current
    const mimeType = recorder.mimeType || chunksRef.current[0]?.type || 'audio/webm'
    const blob = new Blob(chunksRef.current, { type: mimeType })
    chunksRef.current = []
    recorderRef.current = null

    if (blob.size === 0) {
      setStatus('error')
      setError('Аудио не записалось. Проверьте микрофон и попробуйте снова.')
      return
    }
    if (blob.size > maxUploadBytes) {
      setStatus('error')
      setError(`Запись слишком большая. Локальный лимит — ${Math.round(maxUploadBytes / 1024 / 1024)} МБ.`)
      return
    }
    if (elapsedMilliseconds < 1_000) {
      setStatus('error')
      setError('Дубль был короче одной секунды и не сохранён. Запишите полный ответ, прежде чем сохранять подтверждение.')
      return
    }
    const durationSeconds = Math.round(elapsedMilliseconds / 1_000)

    const nextCapture: LocalAudioCapture = {
      blob,
      url: URL.createObjectURL(blob),
      mimeType,
      durationSeconds,
      source: captureSourceRef.current,
    }
    replaceCapture(nextCapture)
    setElapsedSeconds(durationSeconds)
    setStatus('ready')
    onAudioReadyRef.current?.(nextCapture)
  }, [clearTimerAndMeter, maxUploadBytes, releaseStream, replaceCapture])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    setStatus('processing')
    recorder.stop()
  }, [])

  const startMeter = useCallback((stream: MediaStream) => {
    const AudioContextConstructor = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextConstructor) return

    try {
      const audioContext = new AudioContextConstructor()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.72
      audioContext.createMediaStreamSource(stream).connect(analyser)
      audioContextRef.current = audioContext
      const samples = new Uint8Array(analyser.frequencyBinCount)

      const measure = () => {
        analyser.getByteTimeDomainData(samples)
        let energy = 0
        for (const sample of samples) {
          const normalized = (sample - 128) / 128
          energy += normalized * normalized
        }
        const rms = Math.sqrt(energy / samples.length)
        setLevel(Math.min(100, Math.round(rms * 340)))
        animationFrameRef.current = window.requestAnimationFrame(measure)
      }
      measure()
    } catch {
      // A level meter is optional; recording itself should remain available.
    }
  }, [])

  const beginRecording = useCallback((ownedStream: MediaStream, recordingStream: MediaStream, source: 'microphone' | 'system_audio') => {
    const mimeType = selectMimeType()
    streamRef.current = ownedStream
    captureSourceRef.current = source
    const recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined)
    recorderRef.current = recorder
    chunksRef.current = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onerror = () => {
      recorder.onstop = null
      clearTimerAndMeter()
      releaseStream()
      recorderRef.current = null
      if (mountedRef.current) {
        setStatus('error')
        setError('Запись остановлена из-за ошибки аудиоустройства. Попробуйте снова или импортируйте файл.')
      }
    }
    recorder.onstop = () => finishRecording(recorder)
    recorder.start(250)
    startedAtRef.current = performance.now()
    setElapsedSeconds(0)
    setStatus('recording')
    startMeter(recordingStream)
    intervalRef.current = window.setInterval(() => {
      const nextElapsed = Math.floor((performance.now() - startedAtRef.current) / 1000)
      setElapsedSeconds(nextElapsed)
      if (nextElapsed >= maxDurationSeconds) stop()
    }, 200)
  }, [clearTimerAndMeter, finishRecording, maxDurationSeconds, releaseStream, startMeter, stop])

  const start = useCallback(async () => {
    if (!isSupported) {
      setStatus('error')
      setError('Запись вживую здесь не поддерживается. Импортируйте аудиофайл.')
      return
    }
    if (status === 'requesting' || status === 'recording' || status === 'processing') return

    // Retire an imported preview synchronously before requesting a live stream.
    // Its late media events must not be able to overwrite the live recorder.
    replaceCapture(undefined)
    setElapsedSeconds(0)
    setError(undefined)
    setStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mountedRef.current) {
        stopTracks(stream)
        return
      }

      beginRecording(stream, stream, 'microphone')
    } catch (caughtError) {
      releaseStream()
      if (mountedRef.current) {
        setStatus('error')
        setError(formatRecorderError(caughtError))
      }
    }
  }, [beginRecording, isSupported, releaseStream, replaceCapture, status])

  const startSystemAudio = useCallback(async () => {
    if (!isSystemAudioSupported) {
      setStatus('error')
      setError('Запись звука экрана или приложения здесь не поддерживается. Импортируйте аудиофайл.')
      return
    }
    if (status === 'requesting' || status === 'recording' || status === 'processing') return
    replaceCapture(undefined)
    setElapsedSeconds(0)
    setError(undefined)
    setStatus('requesting')
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      if (!mountedRef.current) { stopTracks(displayStream); return }
      const audioTracks = displayStream.getAudioTracks()
      if (!audioTracks.length) {
        stopTracks(displayStream)
        setStatus('error')
        setError('Выбранный экран или приложение не передаёт звук. Выберите источник с общим аудио или импортируйте файл.')
        return
      }
      const audioStream = new MediaStream(audioTracks)
      displayStream.getTracks().forEach((track) => track.addEventListener('ended', stop, { once: true }))
      beginRecording(displayStream, audioStream, 'system_audio')
    } catch (caughtError) {
      releaseStream()
      if (mountedRef.current) {
        const denied = caughtError instanceof DOMException && (caughtError.name === 'NotAllowedError' || caughtError.name === 'SecurityError')
        setStatus('error')
        setError(denied ? 'Доступ к записи экрана и системного аудио запрещён. Разрешите его в системных настройках (на macOS — «Запись экрана и системного аудио») и выберите источник со звуком в диалоге захвата — или импортируйте локальный аудиофайл.' : 'Не удалось запустить запись звука экрана или приложения. Импортируйте локальный аудиофайл.')
      }
    }
  }, [beginRecording, isSystemAudioSupported, releaseStream, replaceCapture, status, stop])

  const importFile = useCallback((file: File) => {
    setError(undefined)
    if (!(file.type.startsWith('audio/') || /\.(aac|flac|m4a|mp3|mp4|ogg|opus|wav|webm)$/i.test(file.name))) {
      setStatus('error')
      setError('Выберите поддерживаемый аудиофайл.')
      return undefined
    }
    if (file.size > maxUploadBytes) {
      setStatus('error')
      setError(`Аудиофайл слишком большой. Лимит — ${Math.round(maxUploadBytes / 1024 / 1024)} МБ.`)
      return undefined
    }

    const nextCapture: LocalAudioCapture = {
      blob: file,
      url: URL.createObjectURL(file),
      mimeType: file.type || 'audio/mpeg',
      durationSeconds: 0,
      source: 'import',
      fileName: file.name,
    }
    replaceCapture(nextCapture)
    setElapsedSeconds(0)
    setStatus('processing')
    return nextCapture
  }, [maxUploadBytes, replaceCapture])

  const updateDuration = useCallback((durationSeconds: number, expectedUrl?: string) => {
    const current = captureRef.current
    if (!current || current.source !== 'import' || (expectedUrl && current.url !== expectedUrl)) return
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      rejectImportedCapture('Не удалось определить длительность аудио. Файл повреждён или его формат не поддерживается. Выберите другой аудиофайл.', expectedUrl)
      return
    }
    if (durationSeconds > maxDurationSeconds) {
      replaceCapture(undefined)
      setElapsedSeconds(0)
      setStatus('error')
      setError(`Аудио длиннее допустимого для этого упражнения (${maxDurationSeconds} с). Выберите более короткий фрагмент.`)
      return
    }
    const next = { ...current, durationSeconds: Math.floor(durationSeconds * 10) / 10 }
    captureRef.current = next
    setCapture(next)
    onAudioReadyRef.current?.(next)
    setElapsedSeconds(Math.floor(durationSeconds))
    setStatus('ready')
  }, [maxDurationSeconds, rejectImportedCapture, replaceCapture])

  const handleMediaError = useCallback((expectedUrl?: string) => {
    rejectImportedCapture('Не удалось прочитать аудиофайл. Он может быть повреждён или использовать неподдерживаемый кодек. Выберите другой файл.', expectedUrl)
  }, [rejectImportedCapture])

  const reset = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      recorder.stop()
    }
    recorderRef.current = null
    chunksRef.current = []
    clearTimerAndMeter()
    releaseStream()
    replaceCapture(undefined)
    setElapsedSeconds(0)
    setError(undefined)
    setStatus('idle')
  }, [clearTimerAndMeter, releaseStream, replaceCapture])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null
        recorder.stop()
      }
      clearTimerAndMeter()
      releaseStream()
      if (captureUrlRef.current) URL.revokeObjectURL(captureUrlRef.current)
      captureUrlRef.current = undefined
      captureRef.current = undefined
    }
  }, [clearTimerAndMeter, releaseStream])

  return {
    isSupported,
    isSystemAudioSupported,
    status,
    elapsedSeconds,
    level,
    error,
    capture,
    start,
    startSystemAudio,
    stop,
    reset,
    importFile,
    updateDuration,
    handleMediaError,
  }
}
