export const MAX_TRANSCRIPT_FILE_BYTES = 512 * 1024
export const MAX_TRANSCRIPT_CHARACTERS = 100_000

const SUPPORTED_TRANSCRIPT_EXTENSIONS = new Set(['txt', 'srt', 'vtt'])
const TIMESTAMP_LINE = /^\s*(?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3}\s+-->\s+(?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3}(?:\s+.*)?$/u

function transcriptExtension(name: string): string {
  return name.toLocaleLowerCase('en-US').split('.').at(-1) ?? ''
}

function decodeCaptionEntities(value: string): string {
  return value
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
}

function captionText(contents: string): string {
  const lines: string[] = []
  let skippingMetadataBlock = false
  let atCueBoundary = true
  let possibleCueIdentifier: number | undefined
  for (const line of contents.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      skippingMetadataBlock = false
      atCueBoundary = true
      possibleCueIdentifier = undefined
      continue
    }
    if (/^(NOTE|STYLE|REGION)(?:\s|$)/u.test(trimmed)) {
      skippingMetadataBlock = true
      continue
    }
    if (skippingMetadataBlock || /^WEBVTT(?:\s|$)/u.test(trimmed) || /^\d+$/u.test(trimmed)) continue
    if (TIMESTAMP_LINE.test(trimmed)) {
      // A WebVTT cue identifier may be any single line immediately before
      // the timing line, not only a number.
      if (possibleCueIdentifier !== undefined) lines.splice(possibleCueIdentifier, 1)
      atCueBoundary = false
      possibleCueIdentifier = undefined
      continue
    }
    lines.push(line.replace(/<[^>]*>/gu, ''))
    if (atCueBoundary) possibleCueIdentifier = lines.length - 1
    atCueBoundary = false
  }
  return lines.join(' ')
}

export function parseTranscriptText(contents: string, fileName: string): string {
  const extension = transcriptExtension(fileName)
  if (!SUPPORTED_TRANSCRIPT_EXTENSIONS.has(extension)) throw new Error('Поддерживаются только локальные файлы TXT, SRT и VTT.')
  const normalized = contents.replace(/^\uFEFF/u, '').replaceAll('\r\n', '\n').replaceAll('\r', '\n')
  if (new TextEncoder().encode(normalized).byteLength > MAX_TRANSCRIPT_FILE_BYTES) throw new Error('Файл транскрипции превышает безопасный лимит 512 КиБ.')

  const text = extension === 'txt'
    ? normalized
    : captionText(normalized)

  const cleaned = decodeCaptionEntities(text).replace(/\s+/gu, ' ').trim()
  if (!cleaned) throw new Error('В файле не найден текст транскрипции.')
  if (cleaned.length > MAX_TRANSCRIPT_CHARACTERS) throw new Error('Транскрипция длиннее безопасного лимита 100 000 символов.')
  return cleaned
}

export async function readTranscriptFile(file: File): Promise<string> {
  if (file.size > MAX_TRANSCRIPT_FILE_BYTES) throw new Error('Файл транскрипции превышает безопасный лимит 512 КиБ.')
  return parseTranscriptText(await file.text(), file.name)
}
