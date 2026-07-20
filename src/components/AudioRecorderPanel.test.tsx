import { StrictMode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioRecorderPanel } from './AudioRecorderPanel'

class MockMediaRecorder {
  static isTypeSupported = vi.fn(() => true)
  state: RecordingState = 'inactive'
  mimeType: string
  ondataavailable: ((event: BlobEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onstop: ((event: Event) => void) | null = null

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType || 'audio/webm'
  }

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    const data = new Blob(['local voice'], { type: this.mimeType })
    this.ondataavailable?.({ data } as BlobEvent)
    this.onstop?.(new Event('stop'))
  }
}

const trackStop = vi.fn()
let nowMilliseconds = 0
const stream = {
  getTracks: () => [{ stop: trackStop }],
} as unknown as MediaStream

function installMediaDevices(getUserMedia: () => Promise<MediaStream>, getDisplayMedia?: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(getUserMedia), ...(getDisplayMedia ? { getDisplayMedia: vi.fn(getDisplayMedia) } : {}) },
  })
}

describe('AudioRecorderPanel', () => {
  beforeEach(() => {
    nowMilliseconds = 0
    vi.spyOn(performance, 'now').mockImplementation(() => nowMilliseconds)
    trackStop.mockClear()
    vi.stubGlobal('MediaRecorder', MockMediaRecorder)
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:local-audio') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
    installMediaDevices(async () => stream)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('only produces a capture after the learner explicitly starts and stops', async () => {
    const user = userEvent.setup()
    const onAudioReady = vi.fn()
    render(<AudioRecorderPanel onAudioReady={onAudioReady} />)

    expect(screen.getByText(/никогда не начинается автоматически/i)).toBeInTheDocument()
    expect(onAudioReady).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /начать запись/i }))
    expect(await screen.findByText(/идёт запись/i)).toBeInTheDocument()
    expect(onAudioReady).not.toHaveBeenCalled()

    nowMilliseconds = 1_250
    await user.click(screen.getByRole('button', { name: /остановить запись/i }))
    expect(await screen.findByRole('region', { name: /записанный дубль/i })).toBeInTheDocument()
    expect(onAudioReady).toHaveBeenCalledTimes(1)
    expect(onAudioReady.mock.calls[0][0]).toMatchObject({
      source: 'microphone',
      mimeType: 'audio/webm;codecs=opus',
      durationSeconds: 1,
    })
    expect(trackStop).toHaveBeenCalledOnce()
  })

  it('turns microphone denial into an actionable import fallback', async () => {
    const user = userEvent.setup()
    installMediaDevices(async () => { throw new DOMException('Denied', 'NotAllowedError') })
    render(<AudioRecorderPanel />)

    await user.click(screen.getByRole('button', { name: /начать запись/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/доступ к микрофону запрещён/i)
    expect(screen.getByRole('button', { name: /импортировать аудио/i })).toBeEnabled()
  })

  it('keeps file import available when live recording is unsupported', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('MediaRecorder', undefined)
    const onAudioReady = vi.fn()
    render(<AudioRecorderPanel onAudioReady={onAudioReady} />)

    expect(screen.getByRole('button', { name: /начать запись/i })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(/не поддерживается/i)

    const file = new File(['voice sample'], 'response.mp3', { type: 'audio/mpeg' })
    await user.upload(screen.getByLabelText(/импортировать аудиофайл/i), file)

    expect(await screen.findByRole('region', { name: /response.mp3/i })).toBeInTheDocument()
    const preview = screen.getByLabelText(/прослушивание аудиодубля/i)
    Object.defineProperty(preview, 'duration', { configurable: true, value: 12 })
    fireEvent.loadedMetadata(preview)
    expect(onAudioReady).toHaveBeenCalledWith(expect.objectContaining({
      source: 'import',
      fileName: 'response.mp3',
      blob: file,
      durationSeconds: 12,
    }))
  })

  it('rejects an imported clip whose metadata exceeds the exercise duration', async () => {
    const user = userEvent.setup()
    const onAudioReady = vi.fn()
    render(<AudioRecorderPanel maxDurationSeconds={3} onAudioReady={onAudioReady} />)
    await user.upload(screen.getByLabelText(/импортировать аудиофайл/i), new File(['voice sample'], 'long.mp3', { type: 'audio/mpeg' }))
    const preview = await screen.findByLabelText(/прослушивание аудиодубля/i)
    Object.defineProperty(preview, 'duration', { configurable: true, value: 4 })
    fireEvent.loadedMetadata(preview)

    expect(await screen.findByRole('alert')).toHaveTextContent(/длиннее допустимого/i)
    expect(screen.queryByLabelText(/прослушивание аудиодубля/i)).not.toBeInTheDocument()
    expect(onAudioReady).not.toHaveBeenCalled()
  })

  it.each([
    ['нулевую', 0],
    ['бесконечную', Number.POSITIVE_INFINITY],
    ['нечисловую', Number.NaN],
  ])('fails closed when an imported clip reports %s duration', async (_label, duration) => {
    const user = userEvent.setup()
    const onAudioReady = vi.fn()
    render(<AudioRecorderPanel onAudioReady={onAudioReady} />)
    await user.upload(screen.getByLabelText(/импортировать аудиофайл/i), new File(['broken'], 'broken.mp3', { type: 'audio/mpeg' }))
    const preview = await screen.findByLabelText(/прослушивание аудиодубля/i)
    Object.defineProperty(preview, 'duration', { configurable: true, value: duration })
    fireEvent.loadedMetadata(preview)

    expect(await screen.findByRole('alert')).toHaveTextContent(/не удалось определить длительность/i)
    expect(screen.queryByLabelText(/прослушивание аудиодубля/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /импортировать аудио/i })).toBeEnabled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-audio')
    expect(onAudioReady).not.toHaveBeenCalled()
  })

  it('recovers after a media decoding error and accepts a replacement import', async () => {
    const user = userEvent.setup()
    const onAudioReady = vi.fn()
    vi.mocked(URL.createObjectURL)
      .mockReturnValueOnce('blob:broken-audio')
      .mockReturnValueOnce('blob:valid-audio')
    render(<AudioRecorderPanel onAudioReady={onAudioReady} />)

    await user.upload(screen.getByLabelText(/импортировать аудиофайл/i), new File(['broken'], 'broken.mp3', { type: 'audio/mpeg' }))
    fireEvent.error(await screen.findByLabelText(/прослушивание аудиодубля/i))

    expect(await screen.findByRole('alert')).toHaveTextContent(/не удалось прочитать аудиофайл/i)
    expect(screen.queryByLabelText(/прослушивание аудиодубля/i)).not.toBeInTheDocument()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:broken-audio')
    expect(screen.getByRole('button', { name: /импортировать аудио/i })).toBeEnabled()

    await user.upload(screen.getByLabelText(/импортировать аудиофайл/i), new File(['valid'], 'valid.mp3', { type: 'audio/mpeg' }))
    const replacement = await screen.findByLabelText(/прослушивание аудиодубля/i)
    Object.defineProperty(replacement, 'duration', { configurable: true, value: 8 })
    fireEvent.loadedMetadata(replacement)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(await screen.findByText(/аудио готово к проверке/i)).toBeInTheDocument()
    expect(onAudioReady).toHaveBeenCalledOnce()
    expect(onAudioReady).toHaveBeenCalledWith(expect.objectContaining({
      fileName: 'valid.mp3',
      durationSeconds: 8,
      url: 'blob:valid-audio',
    }))
  })

  it('retires an imported preview before live recording and ignores its late error event', async () => {
    const user = userEvent.setup()
    const onAudioReady = vi.fn()
    const onClear = vi.fn()
    render(<AudioRecorderPanel onAudioReady={onAudioReady} onClear={onClear} />)
    await user.upload(screen.getByLabelText(/импортировать аудиофайл/i), new File(['ready'], 'ready.mp3', { type: 'audio/mpeg' }))
    const importedPreview = await screen.findByLabelText(/прослушивание аудиодубля/i)
    Object.defineProperty(importedPreview, 'duration', { configurable: true, value: 8 })
    fireEvent.loadedMetadata(importedPreview)
    expect(await screen.findByText(/аудио готово к проверке/i)).toBeInTheDocument()
    onClear.mockClear()

    await user.click(screen.getByRole('button', { name: /начать запись/i }))
    expect(await screen.findByText(/идёт запись/i)).toBeInTheDocument()
    expect(onClear).toHaveBeenCalledOnce()
    fireEvent.error(importedPreview)

    expect(screen.getByText(/идёт запись/i)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /остановить запись/i })).toBeEnabled()
  })

  it('rejects an import above the configured byte limit before preview', async () => {
    const user = userEvent.setup()
    render(<AudioRecorderPanel maxUploadBytes={4} />)
    await user.upload(screen.getByLabelText(/импортировать аудиофайл/i), new File(['12345'], 'large.mp3', { type: 'audio/mpeg' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/слишком большой/i)
    expect(screen.queryByLabelText(/прослушивание аудиодубля/i)).not.toBeInTheDocument()
  })

  it('rejects non-audio imports without replacing the current state', () => {
    render(<AudioRecorderPanel />)
    const invalidFile = new File(['not audio'], 'notes.txt', { type: 'text/plain' })

    fireEvent.change(screen.getByLabelText(/импортировать аудиофайл/i), { target: { files: [invalidFile] } })

    expect(screen.getByRole('alert')).toHaveTextContent(/поддерживаемый аудиофайл/i)
    expect(screen.queryByLabelText(/прослушивание аудиодубля/i)).not.toBeInTheDocument()
  })

  it('releases the microphone if the panel unmounts mid-recording', async () => {
    const user = userEvent.setup()
    const view = render(<AudioRecorderPanel />)
    await user.click(screen.getByRole('button', { name: /начать запись/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /остановить запись/i })).toBeInTheDocument())

    view.unmount()

    expect(trackStop).toHaveBeenCalledOnce()
  })

  it('captures only an explicitly selected screen source with a shared audio track', async () => {
    const user = userEvent.setup()
    const audioTrack = { stop: trackStop, addEventListener: vi.fn() }
    const displayStream = {
      getTracks: () => [audioTrack],
      getAudioTracks: () => [audioTrack],
    } as unknown as MediaStream
    installMediaDevices(async () => stream, async () => displayStream)
    vi.stubGlobal('MediaStream', class {
      private tracks: MediaStreamTrack[]
      constructor(tracks: MediaStreamTrack[]) { this.tracks = tracks }
      getTracks() { return this.tracks }
    })
    const onAudioReady = vi.fn()
    render(<AudioRecorderPanel allowSystemAudio onAudioReady={onAudioReady} />)

    await user.click(screen.getByRole('button', { name: /записать системный звук/i }))
    expect(await screen.findByText(/идёт запись/i)).toBeInTheDocument()
    expect(audioTrack.addEventListener).toHaveBeenCalledWith('ended', expect.any(Function), { once: true })
    nowMilliseconds = 1_500
    await user.click(screen.getByRole('button', { name: /остановить запись/i }))

    expect(onAudioReady).toHaveBeenCalledWith(expect.objectContaining({ source: 'system_audio' }))
    expect(trackStop).toHaveBeenCalledOnce()
  })

  it('remains usable through the React StrictMode effect probe', async () => {
    const user = userEvent.setup()
    const onAudioReady = vi.fn()
    render(<StrictMode><AudioRecorderPanel onAudioReady={onAudioReady} /></StrictMode>)
    await user.click(screen.getByRole('button', { name: /начать запись/i }))
    nowMilliseconds = 1_250
    await user.click(screen.getByRole('button', { name: /остановить запись/i }))
    expect(await screen.findByRole('region', { name: /записанный дубль/i })).toBeInTheDocument()
    expect(onAudioReady).toHaveBeenCalledOnce()
  })

  it('rejects a sub-second take instead of turning it into learning evidence', async () => {
    const user = userEvent.setup()
    const onAudioReady = vi.fn()
    render(<AudioRecorderPanel onAudioReady={onAudioReady} />)
    await user.click(screen.getByRole('button', { name: /начать запись/i }))
    nowMilliseconds = 500
    await user.click(screen.getByRole('button', { name: /остановить запись/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/короче одной секунды/i)
    expect(onAudioReady).not.toHaveBeenCalled()
  })
})
