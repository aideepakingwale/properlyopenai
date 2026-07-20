import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { extractWords, wordToPhonemes, expectedPhonemes } from '../../../shared/phonicsEngine.js';
import { config } from '../config.js';
import { getOpenAI, hasOpenAIKey } from './openaiClient.js';
import { validateReading } from './validationService.js';
import { assessmentsRepo } from '../db/repositories.js';

/** Reject tiny buffers that cannot be real speech */
export const MIN_AUDIO_BYTES = Number(process.env.MIN_AUDIO_BYTES || 2500);

/**
 * Score a recognized transcript against expected text (no ASR).
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
    passed: validation.passed,
  };
}

/**
 * Fail closed — used when there is no usable audio / ASR.
 */
export function assessInsufficient(expectedText, reason = 'insufficient_audio') {
  const result = assessHeuristic(expectedText, '');
  result.path = reason;
  result.passed = false;
  result.validation = {
    ...result.validation,
    passed: false,
    reason,
  };
  result.message =
    reason === 'no_speech_recognized'
      ? 'I could not hear clear words. Please read the sentence aloud into the microphone.'
      : 'Please press Start, read the sentence aloud, then Stop — I need to hear your voice.';
  return result;
}

/**
 * When Whisper adds punctuation or filler, ask a mini model to clean the transcript.
 * Do not snap mistakes back to the target line; scoring must stay transcript-led.
 */
async function refineChildTranscript(openai, expectedText, whisperText) {
  try {
    const completion = await openai.chat.completions.create({
      model: config.chatModel || 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You clean Whisper ASR text for UK Reception/Year 1 phonics (Letters and Sounds).
Children read SHORT CVC lines.
Rules:
- Return the words the child actually appears to have said.
- Do NOT correct a misread word to the expected target.
- Do NOT return the expected line unless Whisper already contains the same words.
- Remove only obvious filler, repeated false starts, and punctuation noise.
- Never invent extra story sentences.
JSON only: {"transcript":"...","usedExpected":true|false,"reason":"..."}`,
        },
        {
          role: 'user',
          content: `EXPECTED: ${expectedText}\nWHISPER: ${whisperText}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);
    const transcript = String(parsed.transcript || '').trim();
    if (!transcript || !extractWords(transcript).length) return null;
    return {
      transcript,
      usedExpected: Boolean(parsed.usedExpected),
      reason: parsed.reason || '',
    };
  } catch (err) {
    console.warn('Transcript refine failed:', err.message);
    return null;
  }
}

/**
 * Transcribe recorded audio with Whisper, refine ASR slips, then score.
 */
export async function assessWithWhisper(expectedText, audioBuffer, mime = 'audio/webm') {
  if (!audioBuffer?.length || audioBuffer.length < MIN_AUDIO_BYTES) {
    return assessInsufficient(expectedText, 'insufficient_audio');
  }

  const openai = getOpenAI({ ignoreMock: true });
  if (!openai || !hasOpenAIKey()) {
    return assessInsufficient(expectedText, 'asr_unavailable');
  }

  const dir = path.join(config.storageDir, 'tmp');
  fs.mkdirSync(dir, { recursive: true });
  const ext = mime.includes('wav')
    ? 'wav'
    : mime.includes('mpeg') || mime.includes('mp3')
      ? 'mp3'
      : 'webm';
  const tmp = path.join(dir, `${uuid()}.${ext}`);
  fs.writeFileSync(tmp, audioBuffer);

  try {
    const expected = String(expectedText || '').trim();
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmp),
      model: process.env.WHISPER_MODEL || 'whisper-1',
      language: 'en',
      prompt: `UK child phonics reading. Target text for context only: "${expected}". Transcribe the words actually spoken. Do not correct mistakes to the target sentence.`,
      temperature: 0,
    });
    const whisperText = String(transcription.text || '').trim();
    if (!whisperText || !extractWords(whisperText).length) {
      return assessInsufficient(expectedText, 'no_speech_recognized');
    }

    let transcript = whisperText;
    let pathLabel = 'whisper';
    let refined = null;

    let result = assessHeuristic(expectedText, transcript);

    // If not a clear pass, clean ASR noise only. Never use a forced expected line for scoring.
    if (!result.validation.passed) {
      refined = await refineChildTranscript(openai, expected, whisperText);
      if (refined?.transcript && !refined.usedExpected) {
        const refinedResult = assessHeuristic(expectedText, refined.transcript);
        // Accept only transcript cleanup that improves the score without forcing the target.
        if (refinedResult.validation.combined >= result.validation.combined) {
          result = refinedResult;
          transcript = refined.transcript;
          pathLabel = 'whisper+refine';
        }
      }
    }

    result.path = pathLabel;
    result.transcript = transcript;
    result.whisperTranscript = whisperText;
    result.audioBytes = audioBuffer.length;
    const pct =
      result.validation.displayScore ??
      Math.round((result.validation.combined || 0) * 100);
    const weak = (result.validation.wordScores || [])
      .filter((w) => w.status === 'missing' || w.status === 'wrong' || w.status === 'partial')
      .slice(0, 3)
      .map((w) => w.expected);
    const focusSentence = result.validation.focusSentence?.sentenceNumber
      ? ` Start with sentence ${result.validation.focusSentence.sentenceNumber}.`
      : '';
    const scope = result.validation.scoringScope === 'overall' ? 'overall' : 'for this line';
    result.message = result.validation.passed
      ? `Great reading — ${pct}% ${scope}.`
      : `Not quite yet (~${pct}% ${scope}).${
          weak.length ? ` Focus on: ${weak.join(', ')}.` : ''
        }${focusSentence} Read the target again slowly.`;
    result.passed = result.validation.passed;
    return result;
  } catch (err) {
    console.warn('Whisper transcription failed:', err.message);
    const fail = assessInsufficient(expectedText, 'asr_error');
    fail.message = `Could not listen to the recording (${err.message}). Try again.`;
    return fail;
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Prefer Whisper on audio; optional typed transcript only as explicit demo fallback.
 */
export async function assessRecording({
  expectedText,
  audioBuffer,
  mime = 'audio/webm',
  typedTranscript = '',
  allowTypedFallback = false,
}) {
  if (audioBuffer?.length >= MIN_AUDIO_BYTES && hasOpenAIKey()) {
    return assessWithWhisper(expectedText, audioBuffer, mime);
  }

  if (allowTypedFallback && typedTranscript?.trim()) {
    const result = assessHeuristic(expectedText, typedTranscript.trim());
    result.path = 'typed-demo';
    result.message = result.validation.passed
      ? 'Demo transcript matched the sentence.'
      : 'Demo transcript did not match enough words.';
    return result;
  }

  if (!hasOpenAIKey()) {
    return assessInsufficient(expectedText, 'asr_unavailable');
  }
  return assessInsufficient(expectedText, 'insufficient_audio');
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
