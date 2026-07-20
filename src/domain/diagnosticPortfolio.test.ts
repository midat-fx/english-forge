import { describe, expect, it } from 'vitest'
import { createSeedData } from '../data/seed'
import { diagnosticPortfolioStatus } from './diagnosticPortfolio'

describe('diagnostic evidence portfolio', () => {
  it('counts only independent post-placement listening, speaking and writing evidence', () => {
    const data = createSeedData()
    const baselineAt = '2026-07-18T10:00:00.000Z'
    data.placementAttempts = [{
      id: 'placement', answers: [], score: 0, maxScore: 0, suggestedLevel: 'A2',
      bandScores: { A2: { correct: 0, total: 0 }, B1: { correct: 0, total: 0 }, B2: { correct: 0, total: 0 }, C1: { correct: 0, total: 0 } }, completedAt: baselineAt,
    }]
    data.listeningAttempts = [{
      id: 'listen', sourceId: 'daily-a2', mode: 'dictation', response: 'The train leaves now.', answerMatched: true,
      revealUsed: false, playbackCompleted: true, referenceTranscript: 'The train leaves now.', comprehensionQuestion: 'When?',
      comprehensionResponse: 'Now', comprehensionExpectedResponse: 'Now', comprehensionMatched: true, listeningEvidenceVersion: 1,
      durationSeconds: 5, createdAt: '2026-07-18T11:00:00.000Z',
    }]
    data.speakingAttempts = [{
      id: 'speak', idempotencyKey: 'speak-key', sessionId: 'session', mode: 'targeted_response', prompt: 'Describe a habit.',
      targetPhraseIds: [], detectedPhraseIds: [], confirmedPhraseIds: [], transcript: 'I would like to describe a useful habit that helps me plan each morning, finish important work, and leave enough time for rest.', durationSeconds: 35,
      recordingId: 'recording', mimeType: 'audio/webm', targetFormVisible: false, supportUsed: false,
      selfRating: { clarity: 3, flow: 3 }, createdAt: '2026-07-18T12:00:00.000Z',
    }]
    const target = data.phrases[0]
    const response = `I ${target.canonical} when I plan my week because a clear routine helps me remember important work. Yesterday I used it while preparing a careful message for my friend, and today I can explain the same idea in a fresh practical context without copying an example.`
    data.missions = [{
      id: 'write', level: 'A2', title: 'Write', prompt: 'Write a short answer.', targetPhraseIds: [target.id],
      minWords: 40, maxWords: 70, targetPhraseCount: 1, supportUsed: false, draft: response, response,
      targetResults: [{ phraseId: target.id, confirmed: true }], status: 'done', createdAt: baselineAt,
      completedAt: '2026-07-18T13:00:00.000Z', selfConfirmedAt: '2026-07-18T13:00:00.000Z',
    }]

    expect(diagnosticPortfolioStatus({ ...data, phrases: data.phrases })).toMatchObject({ baselineAt, completedCount: 3, complete: true })
  })

  it('rejects empty speaking samples and evidence dated in the future', () => {
    const data = createSeedData()
    const baselineAt = '2026-07-18T10:00:00.000Z'
    data.placementAttempts = [{
      id: 'placement', answers: [], score: 0, maxScore: 0, suggestedLevel: 'A2',
      bandScores: { A2: { correct: 0, total: 0 }, B1: { correct: 0, total: 0 }, B2: { correct: 0, total: 0 }, C1: { correct: 0, total: 0 } }, completedAt: baselineAt,
    }]
    data.speakingAttempts = [{
      id: 'empty', idempotencyKey: 'empty', sessionId: 'session', mode: 'targeted_response', prompt: 'Describe a habit.',
      targetPhraseIds: [], detectedPhraseIds: [], confirmedPhraseIds: [], transcript: '', durationSeconds: 40,
      recordingId: 'recording', mimeType: 'audio/webm', targetFormVisible: false, supportUsed: false,
      selfRating: { clarity: 3, flow: 3 }, createdAt: '2026-07-18T11:00:00.000Z',
    }]
    data.listeningAttempts = [{
      id: 'future', sourceId: 'daily-a2', mode: 'dictation', response: 'Now', answerMatched: true,
      revealUsed: false, playbackCompleted: true, referenceTranscript: 'Now', comprehensionQuestion: 'When?',
      comprehensionResponse: 'Now', comprehensionExpectedResponse: 'Now', comprehensionMatched: true, listeningEvidenceVersion: 1,
      durationSeconds: 5, createdAt: '2030-07-18T11:00:00.000Z',
    }]

    expect(diagnosticPortfolioStatus(data, new Date('2026-07-18T12:00:00.000Z'))).toMatchObject({ completedCount: 0, complete: false })
  })

  it('rejects stale, revealed, supported and automatically unverifiable samples', () => {
    const data = createSeedData()
    data.placementAttempts = [{
      id: 'placement', answers: [], score: 0, maxScore: 0, suggestedLevel: 'A2',
      bandScores: { A2: { correct: 0, total: 0 }, B1: { correct: 0, total: 0 }, B2: { correct: 0, total: 0 }, C1: { correct: 0, total: 0 } }, completedAt: '2026-07-18T10:00:00.000Z',
    }]
    data.listeningAttempts = [{
      id: 'listen', sourceId: 'daily-a2', mode: 'dictation', response: 'Answer', answerMatched: true, revealUsed: true,
      playbackCompleted: true, referenceTranscript: 'Answer', comprehensionQuestion: 'Question', comprehensionResponse: 'Answer', comprehensionMatched: true,
      durationSeconds: 5, createdAt: '2026-07-18T11:00:00.000Z',
    }]
    data.speakingAttempts = [{
      id: 'speak', idempotencyKey: 'speak-key', sessionId: 'session', mode: 'targeted_response', prompt: 'Describe a habit.',
      targetPhraseIds: [], detectedPhraseIds: [], confirmedPhraseIds: [], transcript: '', durationSeconds: 40,
      recordingId: 'recording', mimeType: 'audio/webm', targetFormVisible: false, supportUsed: true,
      selfRating: { clarity: 3, flow: 3 }, createdAt: '2026-07-18T11:00:00.000Z',
    }]
    data.missions = [{
      id: 'write', level: 'A2', title: 'Write', prompt: 'Write.', targetPhraseIds: ['phrase-1'], minWords: 40, maxWords: 80,
      targetPhraseCount: 1, supportUsed: false, draft: 'Draft', response: 'Draft', targetResults: [{ phraseId: 'phrase-1', confirmed: true }],
      status: 'done', createdAt: '2026-07-18T10:00:00.000Z', completedAt: '2026-07-18T11:00:00.000Z',
    }]

    expect(diagnosticPortfolioStatus({ ...data, phrases: data.phrases })).toMatchObject({ completedCount: 0, complete: false })
  })
})
