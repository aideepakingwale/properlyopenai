import {
  extractWords,
  expectedPhonemes,
  wordToPhonemes,
  jaccardSimilarity,
} from '../../../shared/phonicsEngine.js';
import { config } from '../config.js';

/** Filler / false starts Whisper often adds for child speech */
const FILLERS = new Set([
  'um', 'uh', 'erm', 'er', 'ah', 'oh', 'okay', 'ok', 'like',
  'hmm', 'mm', 'yeah', 'yes', 'please', 'so', 'and',
]);

/** Soft pairs common in early reading + ASR */
const SOFT_MATCH = new Map([
  ['a', new Set(['a', 'the', 'uh', 'ah'])],
  ['the', new Set(['the', 'a', 'uh', 'ah', 'thu', 'da', 'de'])],
  ['to', new Set(['to', 'too', 'two'])],
  ['i', new Set(['i', 'eye'])],
  ['no', new Set(['no', 'know'])],
  ['go', new Set(['go', 'goes'])],
  ['on', new Set(['on', 'an', 'in'])],
  ['in', new Set(['in', 'on', 'an'])],
  ['mat', new Set(['mat', 'mad', 'map', 'man', 'met'])],
  ['pod', new Set(['pod', 'pot', 'pad', 'bod'])],
  ['sat', new Set(['sat', 'sad', 'sit', 'set'])],
  ['cat', new Set(['cat', 'cap', 'cot', 'kat'])],
]);

/** Exact ASR match never reports 100% — leaves room for real pronunciation nuance */
const EXACT_WORD_CEILING = 0.92;
/** Soft / near-sound match ceiling */
const SOFT_WORD_CEILING = 0.8;
/** Overall score soft cap (never show a perfect 100 from transcript alone) */
const OVERALL_SCORE_CAP = 0.96;
export const READING_SCORER_VERSION = 'v7-strict-overall-phonics';
const SCORER_VERSION = READING_SCORER_VERSION;
const MIN_STRICT_READING_SCORE = envNumber('MIN_STRICT_READING_SCORE', 0.86);
const MIN_STRICT_WORD_COVERAGE = envNumber('MIN_STRICT_WORD_COVERAGE', 0.9);
const MIN_STRICT_PHONEME_SEQUENCE = envNumber('MIN_STRICT_PHONEME_SEQUENCE', 0.82);
const WEAK_WORD_SCORE_CAP = envNumber('WEAK_WORD_SCORE_CAP', 0.78);
const WRONG_WORD_SCORE_CAP = envNumber('WRONG_WORD_SCORE_CAP', 0.58);

function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export function phonemeWordSimilarity(a, b) {
  const pa = wordToPhonemes(a);
  const pb = wordToPhonemes(b);
  if (!pa.length || !pb.length) return 0;
  return jaccardSimilarity(pa, pb);
}

function phonemeLcsRatio(expPh, recPh) {
  if (!expPh.length) return 0;
  if (!recPh.length) return 0;
  const m = expPh.length;
  const n = recPh.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      if (expPh[i - 1] === recPh[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n] / m;
}

function softEqual(a, b) {
  const x = String(a || '').toLowerCase();
  const y = String(b || '').toLowerCase();
  if (!x || !y) return false;
  if (x === y) return true;
  if (SOFT_MATCH.get(x)?.has(y)) return true;
  if (SOFT_MATCH.get(y)?.has(x)) return true;
  if (x.length >= 3 && y.length >= 3 && Math.abs(x.length - y.length) <= 1) {
    if (editDistance(x, y) <= 1) return true;
  }
  if (phonemeWordSimilarity(x, y) >= 0.5 && Math.abs(x.length - y.length) <= 2) {
    return true;
  }
  return false;
}

function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function cleanRecognizedWords(words) {
  return words.map((w) => w.toLowerCase()).filter((w) => w && !FILLERS.has(w));
}

/**
 * Score one expected word against what was heard (with phoneme detail).
 */
export function scoreWordPhonics(expectedWord, heardWord) {
  const expected = String(expectedWord || '').toLowerCase();
  const heard = heardWord ? String(heardWord).toLowerCase() : null;
  const expectedIpa = wordToPhonemes(expected);
  const heardIpa = heard ? wordToPhonemes(heard) : [];

  if (!heard) {
    return {
      expected,
      heard: null,
      status: 'missing',
      score: 0,
      label: 'Missed',
      expectedPhonemes: expectedIpa,
      heardPhonemes: [],
      phonemeMatch: 0,
      tip: `Say /${expectedIpa.join('/ /')}/ — “${expected}”`,
    };
  }

  const exact = expected === heard;
  const soft = softEqual(expected, heard);
  const bag = phonemeWordSimilarity(expected, heard);
  const ordered = phonemeLcsRatio(expectedIpa, heardIpa);
  const phonemeMatch = bag * 0.45 + ordered * 0.55;

  let score;
  let status;
  let label;
  let tip;

  if (exact) {
    // Realistic ceiling — transcript match ≠ perfect articulation
    score = EXACT_WORD_CEILING;
    status = 'exact';
    label = 'Clear';
    tip = `/${expectedIpa.join('/ /')}/`;
  } else if (soft && phonemeMatch >= 0.7) {
    score = Math.min(SOFT_WORD_CEILING, 0.55 + phonemeMatch * 0.3);
    status = 'close';
    label = 'Close';
    tip = `Heard “${heard}” ≈ “${expected}” /${expectedIpa.join('/ /')}/`;
  } else if (soft || phonemeMatch >= 0.45) {
    score = Math.min(0.68, 0.35 + phonemeMatch * 0.35);
    status = 'partial';
    label = 'Almost';
    tip = `Try “${expected}”: /${expectedIpa.join('/ /')}/ (heard “${heard}”)`;
  } else {
    score = Math.min(0.35, phonemeMatch * 0.4);
    status = 'wrong';
    label = 'Retry';
    tip = `Not “${heard}” — say “${expected}”: /${expectedIpa.join('/ /')}/`;
  }

  return {
    expected,
    heard,
    status,
    score: Math.round(score * 1000) / 1000,
    label,
    expectedPhonemes: expectedIpa,
    heardPhonemes: heardIpa,
    phonemeMatch: Math.round(phonemeMatch * 1000) / 1000,
    tip,
  };
}

function matchStrength(expected, heard) {
  if (!expected || !heard) return 0;
  if (expected === heard) return 1;
  if (softEqual(expected, heard)) return 0.85;
  const ph = phonemeWordSimilarity(expected, heard);
  if (ph >= 0.5) return 0.55 + ph * 0.3;
  return ph * 0.5;
}

/**
 * Order-preserving alignment so earlier soft matches cannot steal later words.
 */
export function alignWords(expectedWords, recognizedWords) {
  const heard = cleanRecognizedWords(recognizedWords);
  const n = heard.length;
  if (!expectedWords.length) return { alignment: [], extras: heard };

  const alignment = [];
  const used = new Array(n).fill(false);
  let cursor = 0;

  for (const exp of expectedWords) {
    let bestJ = -1;
    let bestS = -1;
    const end = Math.min(n, cursor + 2);
    for (let j = cursor; j < end; j += 1) {
      if (used[j]) continue;
      const s = matchStrength(exp, heard[j]);
      if (s > bestS) {
        bestS = s;
        bestJ = j;
      }
    }
    // Only look further if the local window had no usable match (e.g. skipped filler)
    if (bestS < 0.35) {
      for (let j = end; j < Math.min(n, cursor + 4); j += 1) {
        if (used[j]) continue;
        const s = matchStrength(exp, heard[j]);
        if (s >= 0.85 && s > bestS) {
          bestS = s;
          bestJ = j;
        }
      }
    }
    if (bestJ >= 0 && bestS >= 0.35) {
      used[bestJ] = true;
      alignment.push({ expected: exp, heard: heard[bestJ] });
      cursor = bestJ + 1;
    } else {
      alignment.push({ expected: exp, heard: null });
    }
  }

  const extras = heard.filter((_, i) => !used[i]);
  return { alignment, extras };
}

function round3(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

function passPolicy() {
  return {
    threshold: Math.max(Number(config.jaccardThreshold) || 0.72, MIN_STRICT_READING_SCORE),
    minCoverage: Math.max(envNumber('MIN_WORD_COVERAGE', 0.7), MIN_STRICT_WORD_COVERAGE),
    minStrongRate: 1,
    minPhonemeSeq: MIN_STRICT_PHONEME_SEQUENCE,
    maxWeakCount: 0,
  };
}

function summarizeStatuses(wordScores) {
  const total = Math.max(wordScores.length, 1);
  const exact = wordScores.filter((w) => w.status === 'exact');
  const close = wordScores.filter((w) => w.status === 'close');
  const partial = wordScores.filter((w) => w.status === 'partial');
  const wrong = wordScores.filter((w) => w.status === 'wrong');
  const missing = wordScores.filter((w) => w.status === 'missing');
  const weak = [...missing, ...wrong, ...partial];
  const wrongOrMissing = [...missing, ...wrong];
  const covered = [...exact, ...close, ...partial].length;
  const phonemeSeq =
    wordScores.reduce((s, w) => s + (w.phonemeMatch || 0), 0) / total;

  return {
    coverage: covered / total,
    exactRate: exact.length / total,
    strongRate: (exact.length + close.length) / total,
    sequence: wordScores.filter((w) => w.heard).length / total,
    phonemeSeq,
    weak,
    wrongOrMissing,
    missing,
    partial,
    close,
  };
}

function decidePass({ combined, summary, policy }) {
  if (summary.wrongOrMissing.length > 0) {
    return { passed: false, reason: 'missing_or_wrong_words' };
  }
  if (summary.weak.length > policy.maxWeakCount) {
    return { passed: false, reason: 'phoneme_errors' };
  }
  if (summary.coverage < policy.minCoverage) {
    return { passed: false, reason: 'low_word_coverage' };
  }
  if (summary.strongRate < policy.minStrongRate) {
    return { passed: false, reason: 'not_enough_clear_words' };
  }
  if (summary.phonemeSeq < policy.minPhonemeSeq) {
    return { passed: false, reason: 'phoneme_accuracy' };
  }
  if (combined < policy.threshold) {
    return { passed: false, reason: 'below_threshold' };
  }
  return { passed: true, reason: 'ok' };
}

function scoreFromWordScores({
  expectedWords,
  recognizedWords,
  rawRecognizedWords = recognizedWords,
  wordScores,
  extras = [],
  targetText = '',
}) {
  const policy = passPolicy();
  const summary = summarizeStatuses(wordScores);
  const wordAvg =
    wordScores.reduce((sum, w) => sum + w.score, 0) / Math.max(wordScores.length, 1);

  // Extra spoken words (not in the line) trim realism a little.
  const extraPenalty = Math.min(0.12, extras.length * 0.03);
  const lengthRatio =
    Math.min(recognizedWords.length, expectedWords.length) /
    Math.max(recognizedWords.length, expectedWords.length, 1);
  const lengthFactor = 0.85 + 0.15 * lengthRatio;

  let combined = wordAvg * lengthFactor - extraPenalty;
  combined = Math.max(0, Math.min(OVERALL_SCORE_CAP, combined));

  // A read with a wrong/missing/partial word must not still look like a high pass.
  if (summary.wrongOrMissing.length > 0) {
    combined = Math.min(combined, WRONG_WORD_SCORE_CAP);
  } else if (summary.weak.length > 0) {
    combined = Math.min(combined, WEAK_WORD_SCORE_CAP);
  }
  combined = round3(combined);

  const jaccardWords = jaccardSimilarity(expectedWords, recognizedWords);
  const jaccardPhonemes = jaccardSimilarity(
    expectedPhonemes(expectedWords.join(' ')),
    recognizedWords.flatMap((w) => wordToPhonemes(w)),
  );
  const decision = decidePass({ combined, summary, policy });

  return {
    jaccardWords,
    jaccardPhonemes,
    coverage: round3(summary.coverage),
    sequence: round3(summary.sequence),
    phonemeSeq: round3(summary.phonemeSeq),
    exactRate: round3(summary.exactRate),
    strongRate: round3(summary.strongRate),
    combined,
    displayScore: Math.round(combined * 100),
    threshold: policy.threshold,
    minCoverage: policy.minCoverage,
    minStrongRate: policy.minStrongRate,
    minPhonemeSeq: policy.minPhonemeSeq,
    maxWeakCount: policy.maxWeakCount,
    passed: decision.passed,
    expectedWords,
    recognizedWords,
    missingWords: summary.missing.map((w) => w.expected),
    weakWords: summary.weak.map((w) => w.expected),
    weakCount: summary.weak.length,
    wrongOrMissingWords: summary.wrongOrMissing.map((w) => w.expected),
    extras,
    wordScores,
    reason: decision.reason,
    rawRecognizedWords,
    targetText,
    scorer: SCORER_VERSION,
  };
}

function sentenceBreakdownFromOverall(overall, sentences) {
  let offset = 0;
  return sentences.map((sentence, index) => {
    const expectedWords = extractWords(sentence);
    const wordScores = overall.wordScores.slice(offset, offset + expectedWords.length);
    offset += expectedWords.length;
    const recognizedWords = wordScores.map((w) => w.heard).filter(Boolean);
    const score = scoreFromWordScores({
      expectedWords,
      recognizedWords,
      rawRecognizedWords: recognizedWords,
      wordScores,
      extras: [],
      targetText: sentence,
    });
    return {
      ...score,
      sentenceIndex: index,
      sentenceNumber: index + 1,
      text: sentence,
    };
  });
}

function splitExpectedSentences(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => extractWords(s).length > 0);
}

function scoreAgainst(expectedText, recognizedText) {
  const expectedWords = extractWords(expectedText);
  const rawRecognized = extractWords(recognizedText);
  const cleaned = cleanRecognizedWords(rawRecognized);

  if (!expectedWords.length) {
    return failResult([], cleaned, 'no_expected_text');
  }
  if (!cleaned.length) {
    return failResult(expectedWords, [], 'no_speech_recognized');
  }

  const { alignment, extras } = alignWords(expectedWords, cleaned);
  const wordScores = alignment.map(({ expected, heard }) => scoreWordPhonics(expected, heard));

  return {
    ...scoreFromWordScores({
      expectedWords,
      recognizedWords: cleaned,
      rawRecognizedWords: rawRecognized,
      wordScores,
      extras,
      targetText: expectedText,
    }),
    expectedWords,
  };
}

/**
 * Compare recognized speech against expected reading text with per-word phonics scores.
 */
export function validateReading(expectedText, recognizedText) {
  const full = String(expectedText || '').trim();
  const heard = String(recognizedText || '').trim();
  const sentences = splitExpectedSentences(full);

  if (!heard || !extractWords(heard).length) {
    return failResult(extractWords(full), [], 'no_speech_recognized');
  }

  const overall = scoreAgainst(full, heard);
  const sentenceScores = sentenceBreakdownFromOverall(
    overall,
    sentences.length ? sentences : [full],
  );
  const focusSentence =
    sentenceScores.find((s) => !s.passed && s.weakCount > 0) ||
    sentenceScores.find((s) => !s.passed) ||
    null;

  return {
    ...overall,
    sentenceScores,
    focusSentence: focusSentence
      ? {
          sentenceIndex: focusSentence.sentenceIndex,
          sentenceNumber: focusSentence.sentenceNumber,
          text: focusSentence.text,
          displayScore: focusSentence.displayScore,
          reason: focusSentence.reason,
          weakWords: focusSentence.weakWords,
        }
      : null,
    scoringScope: sentenceScores.length > 1 ? 'overall' : 'sentence',
  };
}

function failResult(expectedWords, recognizedWords, reason) {
  const wordScores = expectedWords.map((w) => scoreWordPhonics(w, null));
  const policy = passPolicy();
  return {
    jaccardWords: 0,
    jaccardPhonemes: 0,
    coverage: 0,
    sequence: 0,
    phonemeSeq: 0,
    exactRate: 0,
    strongRate: 0,
    combined: 0,
    displayScore: 0,
    threshold: policy.threshold,
    minCoverage: policy.minCoverage,
    minStrongRate: policy.minStrongRate,
    minPhonemeSeq: policy.minPhonemeSeq,
    maxWeakCount: policy.maxWeakCount,
    passed: false,
    expectedWords,
    recognizedWords,
    missingWords: [...expectedWords],
    weakWords: [...expectedWords],
    weakCount: expectedWords.length,
    wrongOrMissingWords: [...expectedWords],
    extras: [],
    wordScores,
    reason,
    sentenceScores: [],
    focusSentence: null,
    scoringScope: expectedWords.length ? 'sentence' : 'unknown',
    scorer: SCORER_VERSION,
  };
}
