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

  const wordAvg =
    wordScores.reduce((sum, w) => sum + w.score, 0) / Math.max(wordScores.length, 1);

  // Extra spoken words (not in the line) trim realism a little
  const extraPenalty = Math.min(0.12, extras.length * 0.03);
  // Length mismatch penalty
  const lengthRatio =
    Math.min(cleaned.length, expectedWords.length) /
    Math.max(cleaned.length, expectedWords.length);
  const lengthFactor = 0.85 + 0.15 * lengthRatio;

  let combined = wordAvg * lengthFactor - extraPenalty;
  combined = Math.max(0, Math.min(OVERALL_SCORE_CAP, combined));
  combined = Math.round(combined * 1000) / 1000;

  const coverage =
    wordScores.filter((w) => w.status === 'exact' || w.status === 'close' || w.status === 'partial')
      .length / wordScores.length;
  const exactRate = wordScores.filter((w) => w.status === 'exact').length / wordScores.length;
  const sequence = wordScores.filter((w) => w.heard).length / wordScores.length;
  const phonemeSeq =
    wordScores.reduce((s, w) => s + (w.phonemeMatch || 0), 0) / wordScores.length;

  const jaccardWords = jaccardSimilarity(expectedWords, cleaned);
  const jaccardPhonemes = jaccardSimilarity(
    expectedPhonemes(expectedWords.join(' ')),
    cleaned.flatMap((w) => wordToPhonemes(w)),
  );

  // Word-phonics average needs a higher bar than old bag Jaccard
  const threshold = Math.max(Number(config.jaccardThreshold) || 0.72, 0.72);
  const minCoverage = Number(process.env.MIN_WORD_COVERAGE || 0.7);
  const missingWords = wordScores.filter((w) => w.status === 'missing').map((w) => w.expected);
  const weakCount = wordScores.filter(
    (w) => w.status === 'missing' || w.status === 'wrong' || w.status === 'partial',
  ).length;
  const strongRate =
    wordScores.filter((w) => w.status === 'exact' || w.status === 'close').length /
    wordScores.length;

  const passed =
    combined >= threshold &&
    coverage >= minCoverage &&
    strongRate >= 0.65 &&
    weakCount <= Math.max(1, Math.floor(wordScores.length * 0.25));

  return {
    jaccardWords,
    jaccardPhonemes,
    coverage: Math.round(coverage * 1000) / 1000,
    sequence: Math.round(sequence * 1000) / 1000,
    phonemeSeq: Math.round(phonemeSeq * 1000) / 1000,
    exactRate: Math.round(exactRate * 1000) / 1000,
    combined,
    displayScore: Math.round(combined * 100),
    threshold,
    minCoverage,
    passed,
    expectedWords,
    recognizedWords: cleaned,
    missingWords,
    extras,
    wordScores,
    reason: passed ? 'ok' : coverage < minCoverage ? 'low_word_coverage' : 'below_threshold',
    rawRecognizedWords: rawRecognized,
    targetText: expectedText,
    scorer: 'v6-word-phonics',
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

  let best = scoreAgainst(full, heard);

  if (sentences.length > 1) {
    for (const sentence of sentences) {
      const v = scoreAgainst(sentence, heard);
      if (v.combined > best.combined) {
        best = { ...v, matchedSentence: sentence };
      }
    }
  } else if (sentences.length === 1) {
    const v = scoreAgainst(sentences[0], heard);
    if (v.combined >= best.combined) best = v;
  }

  return best;
}

function failResult(expectedWords, recognizedWords, reason) {
  const wordScores = expectedWords.map((w) => scoreWordPhonics(w, null));
  return {
    jaccardWords: 0,
    jaccardPhonemes: 0,
    coverage: 0,
    sequence: 0,
    phonemeSeq: 0,
    exactRate: 0,
    combined: 0,
    displayScore: 0,
    threshold: Number(config.jaccardThreshold) || 0.55,
    minCoverage: Number(process.env.MIN_WORD_COVERAGE || 0.55),
    passed: false,
    expectedWords,
    recognizedWords,
    missingWords: [...expectedWords],
    extras: [],
    wordScores,
    reason,
    scorer: 'v6-word-phonics',
  };
}
