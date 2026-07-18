import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { extractWords, wordToPhonemes, expectedPhonemes } from '../../../shared/phonicsEngine.js';
import { config } from '../config.js';
import { getOpenAI, isMockMode } from './openaiClient.js';
import { validateReading } from './validationService.js';
import { assessmentsRepo } from '../db/repositories.js';

/**
 * Heuristic path: compare client-provided interim transcript / word guesses
 * without calling Whisper (near real-time).
 */
export function assessHeuristic(expectedText, interimText) {
  const validation = validateReading(expectedText, interimText || '');
  const expectedPh = expectedPhonemes(expectedText);
  const recognizedWords = extractWords(interimText || '');
  const phonemeScores = {};
  for (const w of recognizedWords) {
    phonemeScores[w] = wordToPhonemes(w);
  }
  return {
    path: 'heuristic',
    transcript: interimText || '',
    validation,
    phonemeScores,
    expectedPhonemes: expectedPh,
  };
}

/**
 * Whisper fallback for end-of-utterance or unstable streams.
 */
export async function assessWithWhisper(expectedText, audioBuffer, mime = 'audio/webm') {
  if (isMockMode() || !audioBuffer?.length) {
    // Mock: pretend child read ~60% of the words
    const words = extractWords(expectedText);
    const half = words.filter((_, i) => i % 2 === 0).join(' ');
    const result = assessHeuristic(expectedText, half);
    result.path = 'whisper-mock';
    return result;
  }

  const openai = getOpenAI();
  const dir = path.join(config.storageDir, 'tmp');
  fs.mkdirSync(dir, { recursive: true });
  const ext = mime.includes('wav') ? 'wav' : mime.includes('mpeg') ? 'mp3' : 'webm';
  const tmp = path.join(dir, `${uuid()}.${ext}`);
  fs.writeFileSync(tmp, audioBuffer);

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmp),
      model: 'whisper-1',
      language: 'en',
    });
    const transcript = transcription.text || '';
    const result = assessHeuristic(expectedText, transcript);
    result.path = 'whisper';
    result.transcript = transcript;
    return result;
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

export function persistAssessment(sessionId, result) {
  return assessmentsRepo.create({
    sessionId,
    expected: result.validation?.expectedWords?.join(' ') || '',
    recognized: result.transcript || '',
    phonemeScores: result.phonemeScores || {},
    jaccardWords: result.validation?.jaccardWords,
    jaccardPhonemes: result.validation?.jaccardPhonemes,
    path: result.path,
  });
}
