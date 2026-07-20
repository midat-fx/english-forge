import { describe, expect, it } from 'vitest'
import { MAX_TRANSCRIPT_FILE_BYTES, parseTranscriptText, readTranscriptFile } from './transcriptFile'

describe('local transcript sidecars', () => {
  it('imports plain text and removes a byte-order mark', () => {
    expect(parseTranscriptText('\uFEFF  A short local transcript.\nSecond line. ', 'sample.TXT')).toBe('A short local transcript. Second line.')
  })

  it('removes SRT indices, timestamps and formatting tags', () => {
    const source = `1\n00:00:01,000 --> 00:00:03,500\n<v Speaker><b>Hello &amp; welcome.</b>\n\n2\n00:00:04,000 --> 00:00:06,000\nThis stays local.`
    expect(parseTranscriptText(source, 'lesson.srt')).toBe('Hello & welcome. This stays local.')
  })

  it('removes VTT metadata without treating it as learner text', () => {
    const source = `WEBVTT\n\nNOTE generated locally\nThis metadata must not become transcript text.\n\n00:01.000 --> 00:03.000 align:start\n<c.green>First cue.</c>\n\n00:04.000 --> 00:05.000\nSecond cue.`
    expect(parseTranscriptText(source, 'lesson.vtt')).toBe('First cue. Second cue.')
  })

  it('accepts a WEBVTT header comment and arbitrary cue identifiers', () => {
    const source = `WEBVTT - exported by a local editor\n\nopening-cue\n00:00:01.000 --> 00:00:03.000\nFirst identified cue.\n\nscene-2_take-A\n00:00:04.000 --> 00:00:06.000 position:10%\nSecond identified cue.`
    expect(parseTranscriptText(source, 'identified.vtt')).toBe('First identified cue. Second identified cue.')
  })

  it('rejects unsupported, empty and oversized sidecars', async () => {
    expect(() => parseTranscriptText('text', 'lesson.docx')).toThrow('TXT, SRT и VTT')
    expect(() => parseTranscriptText('WEBVTT\n\n00:01.000 --> 00:02.000', 'empty.vtt')).toThrow('не найден текст')
    const oversized = new File(['x'.repeat(MAX_TRANSCRIPT_FILE_BYTES + 1)], 'large.txt', { type: 'text/plain' })
    await expect(readTranscriptFile(oversized)).rejects.toThrow('512 КиБ')
  })
})
