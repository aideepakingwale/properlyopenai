/**
 * Properly phonicsEngine — single source of truth for DfE Letters and Sounds,
 * all 44 IPA phonemes (colours, example words, phase metadata, blend arrays,
 * audio recipes), grapheme maps, and vocabulary allowlists.
 *
 * Consumers: usePhonemePlayer, PhonicsLearn, PhonicsWord, phonicsAnalyser,
 * Node API assessment / story constraints, React highlighting.
 */

import {
  PHONEME_AUDIO_RECIPES,
  PHONEME_BLENDS,
  PHONEME_EXAMPLE_WORDS,
  PHONEME_PHASE,
} from './phonemeAudioRecipes.js';
import { IPA_AUDIO_SLUG, phonemeAudioUrl } from './phonemeAudioMap.js';

/**
 * @typedef {{
 *  ipa: string,
 *  name: string,
 *  color: string,
 *  examples: string[],
 *  exampleWords: string[],
 *  blend: string[],
 *  phase: number,
 *  category: 'consonant'|'vowel',
 *  cue: string,
 *  tipSpeak: string,
 *  stretch: boolean,
 *  audio: object,
 * }} PhonemeMeta
 */
/** @typedef {{ grapheme: string, ipa: string, color: string }} GraphemeTile */

// ---------------------------------------------------------------------------
// 44 IPA phonemes (Received Pronunciation / UK classroom convention)
// ---------------------------------------------------------------------------

/** @type {Record<string, PhonemeMeta>} */
export const PHONEMES = {
  // Consonants
  p: { ipa: 'p', name: 'p', color: '#E85D4C', examples: ['p', 'pp'] },
  b: { ipa: 'b', name: 'b', color: '#E85D4C', examples: ['b', 'bb'] },
  t: { ipa: 't', name: 't', color: '#F4A261', examples: ['t', 'tt'] },
  d: { ipa: 'd', name: 'd', color: '#F4A261', examples: ['d', 'dd'] },
  k: { ipa: 'k', name: 'k', color: '#E9C46A', examples: ['c', 'k', 'ck', 'ch'] },
  g: { ipa: 'g', name: 'g', color: '#E9C46A', examples: ['g', 'gg'] },
  tʃ: { ipa: 'tʃ', name: 'ch', color: '#2A9D8F', examples: ['ch', 'tch'] },
  dʒ: { ipa: 'dʒ', name: 'j', color: '#2A9D8F', examples: ['j', 'g', 'dge'] },
  f: { ipa: 'f', name: 'f', color: '#264653', examples: ['f', 'ff', 'ph'] },
  v: { ipa: 'v', name: 'v', color: '#264653', examples: ['v'] },
  θ: { ipa: 'θ', name: 'th (thin)', color: '#6D6875', examples: ['th'] },
  ð: { ipa: 'ð', name: 'th (this)', color: '#6D6875', examples: ['th'] },
  s: { ipa: 's', name: 's', color: '#457B9D', examples: ['s', 'ss', 'c'] },
  z: { ipa: 'z', name: 'z', color: '#457B9D', examples: ['z', 'zz', 's'] },
  ʃ: { ipa: 'ʃ', name: 'sh', color: '#1D3557', examples: ['sh', 'ch', 'ti'] },
  ʒ: { ipa: 'ʒ', name: 'zh', color: '#1D3557', examples: ['s', 'si'] },
  h: { ipa: 'h', name: 'h', color: '#A8DADC', examples: ['h'] },
  m: { ipa: 'm', name: 'm', color: '#E63946', examples: ['m', 'mm'] },
  n: { ipa: 'n', name: 'n', color: '#E63946', examples: ['n', 'nn', 'kn'] },
  ŋ: { ipa: 'ŋ', name: 'ng', color: '#E63946', examples: ['ng', 'n'] },
  l: { ipa: 'l', name: 'l', color: '#F77F00', examples: ['l', 'll'] },
  r: { ipa: 'r', name: 'r', color: '#F77F00', examples: ['r', 'rr', 'wr'] },
  w: { ipa: 'w', name: 'w', color: '#FCBF49', examples: ['w', 'wh'] },
  j: { ipa: 'j', name: 'y', color: '#FCBF49', examples: ['y'] },
  // Short vowels
  æ: { ipa: 'æ', name: 'a (cat)', color: '#06D6A0', examples: ['a'] },
  e: { ipa: 'e', name: 'e (bed)', color: '#06D6A0', examples: ['e', 'ea'] },
  ɪ: { ipa: 'ɪ', name: 'i (pin)', color: '#06D6A0', examples: ['i', 'y'] },
  ɒ: { ipa: 'ɒ', name: 'o (hot)', color: '#06D6A0', examples: ['o', 'a'] },
  ʌ: { ipa: 'ʌ', name: 'u (cup)', color: '#06D6A0', examples: ['u', 'o'] },
  ʊ: { ipa: 'ʊ', name: 'oo (book)', color: '#118AB2', examples: ['oo', 'u'] },
  ə: { ipa: 'ə', name: 'schwa', color: '#118AB2', examples: ['a', 'er', 'or'] },
  // Long vowels / diphthongs
  iː: { ipa: 'iː', name: 'ee', color: '#073B4C', examples: ['ee', 'ea', 'e'] },
  ɑː: { ipa: 'ɑː', name: 'ar', color: '#073B4C', examples: ['ar', 'a'] },
  ɔː: { ipa: 'ɔː', name: 'or', color: '#073B4C', examples: ['or', 'aw', 'au'] },
  uː: { ipa: 'uː', name: 'oo (moon)', color: '#073B4C', examples: ['oo', 'ue', 'ew'] },
  ɜː: { ipa: 'ɜː', name: 'ur', color: '#073B4C', examples: ['ur', 'ir', 'er'] },
  eɪ: { ipa: 'eɪ', name: 'ai', color: '#9B5DE5', examples: ['ai', 'ay', 'a-e'] },
  aɪ: { ipa: 'aɪ', name: 'igh', color: '#9B5DE5', examples: ['igh', 'ie', 'i-e'] },
  ɔɪ: { ipa: 'ɔɪ', name: 'oi', color: '#9B5DE5', examples: ['oi', 'oy'] },
  aʊ: { ipa: 'aʊ', name: 'ow', color: '#F15BB5', examples: ['ow', 'ou'] },
  əʊ: { ipa: 'əʊ', name: 'oa', color: '#F15BB5', examples: ['oa', 'ow', 'o-e'] },
  ɪə: { ipa: 'ɪə', name: 'ear', color: '#00BBF9', examples: ['ear', 'eer'] },
  eə: { ipa: 'eə', name: 'air', color: '#00BBF9', examples: ['air', 'are'] },
  ʊə: { ipa: 'ʊə', name: 'ure', color: '#00BBF9', examples: ['ure', 'our'] },
};

export const ALL_IPA = Object.keys(PHONEMES);

/** Consonant vs vowel sets for UI grouping */
export const CONSONANT_IPA = ALL_IPA.filter((ipa) =>
  !['æ', 'e', 'ɪ', 'ɒ', 'ʌ', 'ʊ', 'ə', 'iː', 'ɑː', 'ɔː', 'uː', 'ɜː', 'eɪ', 'aɪ', 'ɔɪ', 'aʊ', 'əʊ', 'ɪə', 'eə', 'ʊə'].includes(ipa),
);
export const VOWEL_IPA = ALL_IPA.filter((ipa) => !CONSONANT_IPA.includes(ipa));

// ---------------------------------------------------------------------------
// Grapheme → preferred IPA (longest-match tokenization)
// ---------------------------------------------------------------------------

/** Ordered longest-first for greedy grapheme matching */
export const GRAPHEME_IPA = [
  ['tch', 'tʃ'],
  ['dge', 'dʒ'],
  ['igh', 'aɪ'],
  ['ear', 'ɪə'],
  ['air', 'eə'],
  ['ure', 'ʊə'],
  ['oor', 'ɔː'],
  ['our', 'ɔː'],
  ['ore', 'ɔː'],
  ['are', 'eə'],
  ['eer', 'ɪə'],
  ['ch', 'tʃ'],
  ['sh', 'ʃ'],
  ['th', 'θ'],
  ['ng', 'ŋ'],
  ['ck', 'k'],
  ['qu', 'k'], // + w handled separately in tokenize; map start
  ['wh', 'w'],
  ['ph', 'f'],
  ['kn', 'n'],
  ['wr', 'r'],
  ['ai', 'eɪ'],
  ['ay', 'eɪ'],
  ['ee', 'iː'],
  ['ea', 'iː'],
  ['oa', 'əʊ'],
  ['ow', 'aʊ'],
  ['ou', 'aʊ'],
  ['oi', 'ɔɪ'],
  ['oy', 'ɔɪ'],
  ['oo', 'uː'],
  ['ue', 'uː'],
  ['ew', 'uː'],
  ['ar', 'ɑː'],
  ['or', 'ɔː'],
  ['ur', 'ɜː'],
  ['ir', 'ɜː'],
  ['er', 'ə'],
  ['aw', 'ɔː'],
  ['au', 'ɔː'],
  ['ie', 'aɪ'],
  ['a', 'æ'],
  ['e', 'e'],
  ['i', 'ɪ'],
  ['o', 'ɒ'],
  ['u', 'ʌ'],
  ['y', 'ɪ'],
  ['b', 'b'],
  ['c', 'k'],
  ['d', 'd'],
  ['f', 'f'],
  ['g', 'g'],
  ['h', 'h'],
  ['j', 'dʒ'],
  ['k', 'k'],
  ['l', 'l'],
  ['m', 'm'],
  ['n', 'n'],
  ['p', 'p'],
  ['r', 'r'],
  ['s', 's'],
  ['t', 't'],
  ['v', 'v'],
  ['w', 'w'],
  ['x', 'k'], // /ks/ simplified to k for tile display; see tokenizeWord
  ['z', 'z'],
].sort((a, b) => b[0].length - a[0].length);

// ---------------------------------------------------------------------------
// Letters and Sounds phases
// ---------------------------------------------------------------------------

export const PHASES = {
  1: {
    id: 1,
    name: 'Phase 1 — Environmental sounds',
    description: 'Listening, rhyme, and oral blending awareness (no graphemes yet).',
    graphemes: [],
    trickyWords: [],
    vocabulary: [],
  },
  2: {
    id: 2,
    name: 'Phase 2 — First GPCs',
    description: 's a t p i n m d g o c k ck e u r h b f ff l ll ss',
    graphemes: [
      's', 'a', 't', 'p', 'i', 'n', 'm', 'd', 'g', 'o', 'c', 'k', 'ck',
      'e', 'u', 'r', 'h', 'b', 'f', 'ff', 'l', 'll', 'ss',
    ],
    trickyWords: ['the', 'to', 'I', 'no', 'go', 'into'],
    vocabulary: [
      'sat', 'pat', 'tap', 'sap', 'pin', 'nip', 'sip', 'tip', 'pan', 'nap',
      'man', 'mat', 'map', 'am', 'mad', 'dad', 'sad', 'dim', 'dig', 'gap',
      'nag', 'tag', 'got', 'dog', 'pod', 'pot', 'pop', 'cot', 'cop', 'cap',
      'cat', 'kit', 'kick', 'sick', 'sock', 'pick', 'pack', 'peck', 'get',
      'pet', 'ten', 'net', 'met', 'men', 'set', 'pen', 'peg', 'pig', 'mug',
      'cup', 'run', 'mud', 'sun', 'hut', 'bun', 'rug', 'cup', 'but', 'big',
      'had', 'him', 'his', 'hot', 'hug', 'hum', 'hat', 'hop', 'bed', 'bet',
      'bell', 'fill', 'full', 'mess', 'hiss', 'less', 'boss', 'fizz', 'off',
      'puff', 'huff', 'fan', 'fin', 'fog', 'if', 'leg', 'log', 'lot', 'let',
      'lit', 'lip', 'lap', 'red', 'rat', 'rip', 'rag', 'rub', 'rim', 'bad',
      'bag', 'bat', 'bit', 'bin', 'bug', 'bun', 'bus', 'sit', 'sin', 'sod',
      'a', 'at', 'it', 'in', 'is', 'on', 'up', 'an', 'as', 'us',
    ],
  },
  3: {
    id: 3,
    name: 'Phase 3 — Digraphs',
    description: 'j v w x y z zz qu ch sh th ng ai ee igh oa oo ar or ur ow oi ear air ure er',
    graphemes: [
      'j', 'v', 'w', 'x', 'y', 'z', 'zz', 'qu', 'ch', 'sh', 'th', 'ng',
      'ai', 'ee', 'igh', 'oa', 'oo', 'ar', 'or', 'ur', 'ow', 'oi', 'ear', 'air', 'ure', 'er',
    ],
    trickyWords: [
      'he', 'she', 'we', 'me', 'be', 'was', 'you', 'they', 'all', 'are',
      'my', 'her', 'the', 'to', 'I', 'no', 'go', 'into',
    ],
    vocabulary: [
      'jam', 'jet', 'jog', 'jug', 'van', 'vet', 'vip', 'win', 'wag', 'web',
      'box', 'fix', 'six', 'yes', 'yap', 'yell', 'zip', 'buzz', 'quiz', 'quit',
      'chip', 'chop', 'chat', 'rich', 'such', 'much', 'ship', 'shop', 'fish',
      'wish', 'thin', 'this', 'that', 'with', 'them', 'then', 'path', 'moth',
      'ring', 'sing', 'king', 'long', 'song', 'bang', 'rain', 'tail', 'wait',
      'pain', 'sail', 'see', 'tree', 'bee', 'feel', 'keep', 'sheep', 'night',
      'light', 'high', 'right', 'boat', 'road', 'coat', 'soap', 'moon', 'soon',
      'food', 'boot', 'book', 'look', 'good', 'took', 'car', 'park', 'farm',
      'dark', 'for', 'born', 'torn', 'short', 'burn', 'turn', 'hurt', 'curl',
      'cow', 'how', 'down', 'town', 'oil', 'boil', 'coin', 'join', 'ear',
      'hear', 'near', 'dear', 'air', 'fair', 'hair', 'pair', 'sure', 'pure',
      'cure', 'her', 'term', 'fern', 'winter', 'summer', 'boxer', 'mixer',
    ],
  },
  4: {
    id: 4,
    name: 'Phase 4 — Adjacent consonants',
    description: 'CVCC, CCVC, CCVCC words; no new graphemes',
    graphemes: [],
    trickyWords: [
      'said', 'have', 'like', 'so', 'do', 'some', 'come', 'were', 'there',
      'little', 'one', 'when', 'out', 'what', 'he', 'she', 'we', 'me', 'be',
      'was', 'you', 'they', 'all', 'are', 'my', 'her',
    ],
    vocabulary: [
      'went', 'best', 'tent', 'nest', 'just', 'help', 'jump', 'lamp', 'hand',
      'land', 'bend', 'mend', 'lost', 'frost', 'milk', 'shelf', 'think',
      'thank', 'from', 'frog', 'flag', 'swim', 'spot', 'stop', 'step', 'trip',
      'trap', 'grab', 'grin', 'slip', 'slap', 'plan', 'plum', 'clap', 'clip',
      'crab', 'crib', 'drum', 'drop', 'brush', 'crash', 'fresh', 'bring',
      'strong', 'string', 'spring', 'splash', 'script', 'crisp', 'trust',
      'blend', 'stamp', 'stand', 'grand', 'print', 'twist', 'frost',
    ],
  },
  5: {
    id: 5,
    name: 'Phase 5 — Alternative spellings',
    description: 'Alternative graphemes and pronunciations for known phonemes',
    graphemes: [
      'ay', 'ou', 'ie', 'ea', 'oy', 'ir', 'ue', 'aw', 'wh', 'ph', 'ew', 'oe',
      'au', 'ey', 'a-e', 'e-e', 'i-e', 'o-e', 'u-e',
    ],
    trickyWords: [
      'oh', 'their', 'people', 'Mr', 'Mrs', 'looked', 'called', 'asked',
      'could', 'would', 'should', 'said', 'have', 'like', 'so', 'do', 'some',
      'come', 'were', 'there', 'little', 'one', 'when', 'out', 'what',
    ],
    vocabulary: [
      'day', 'play', 'may', 'way', 'cloud', 'proud', 'about', 'shout', 'tie',
      'pie', 'lie', 'cried', 'sea', 'dream', 'leaf', 'beach', 'boy', 'toy',
      'enjoy', 'bird', 'girl', 'first', 'third', 'blue', 'true', 'glue',
      'saw', 'draw', 'yawn', 'when', 'which', 'wheel', 'whisper', 'phone',
      'dolphin', 'alphabet', 'new', 'few', 'grew', 'toe', 'goes', 'heroes',
      'August', 'haunt', 'author', 'they', 'grey', 'obey', 'make', 'came',
      'same', 'these', 'complete', 'like', 'time', 'home', 'hope', 'tune',
      'flute', 'huge', 'cube',
    ],
  },
};

// ---------------------------------------------------------------------------
// Word-level pronunciation dictionary (scaffold subset for assessment)
// ---------------------------------------------------------------------------

/** @type {Record<string, string[]>} */
const PRONUNCIATIONS = {
  sat: ['s', 'æ', 't'], pat: ['p', 'æ', 't'], tap: ['t', 'æ', 'p'], pin: ['p', 'ɪ', 'n'],
  man: ['m', 'æ', 'n'], mat: ['m', 'æ', 't'], map: ['m', 'æ', 'p'], dad: ['d', 'æ', 'd'],
  sad: ['s', 'æ', 'd'], dig: ['d', 'ɪ', 'g'], dog: ['d', 'ɒ', 'g'], cat: ['k', 'æ', 't'],
  kit: ['k', 'ɪ', 't'], get: ['g', 'e', 't'], pet: ['p', 'e', 't'], sun: ['s', 'ʌ', 'n'],
  run: ['r', 'ʌ', 'n'], big: ['b', 'ɪ', 'g'], hot: ['h', 'ɒ', 't'], bed: ['b', 'e', 'd'],
  the: ['ð', 'ə'], to: ['t', 'uː'], i: ['aɪ'], no: ['n', 'əʊ'], go: ['g', 'əʊ'],
  into: ['ɪ', 'n', 't', 'uː'], ship: ['ʃ', 'ɪ', 'p'], fish: ['f', 'ɪ', 'ʃ'],
  chip: ['tʃ', 'ɪ', 'p'], this: ['ð', 'ɪ', 's'], that: ['ð', 'æ', 't'],
  rain: ['r', 'eɪ', 'n'], tree: ['t', 'r', 'iː'], night: ['n', 'aɪ', 't'],
  boat: ['b', 'əʊ', 't'], moon: ['m', 'uː', 'n'], book: ['b', 'ʊ', 'k'],
  car: ['k', 'ɑː'], for: ['f', 'ɔː'], cow: ['k', 'aʊ'], oil: ['ɔɪ', 'l'],
  ear: ['ɪə'], air: ['eə'], her: ['h', 'ɜː'], went: ['w', 'e', 'n', 't'],
  frog: ['f', 'r', 'ɒ', 'g'], stop: ['s', 't', 'ɒ', 'p'], day: ['d', 'eɪ'],
  play: ['p', 'l', 'eɪ'], make: ['m', 'eɪ', 'k'], like: ['l', 'aɪ', 'k'],
  time: ['t', 'aɪ', 'm'], home: ['h', 'əʊ', 'm'], dragon: ['d', 'r', 'æ', 'g', 'ə', 'n'],
  space: ['s', 'p', 'eɪ', 's'], animal: ['æ', 'n', 'ɪ', 'm', 'ə', 'l'],
};

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * @param {number} phase
 */
export function getPhase(phase) {
  return PHASES[phase] || null;
}

/**
 * Cumulative vocabulary + tricky words up to and including phase.
 * @param {number} phase
 * @returns {Set<string>}
 */
export function getPhaseVocabulary(phase) {
  const words = new Set();
  for (let p = 1; p <= phase; p += 1) {
    const ph = PHASES[p];
    if (!ph) continue;
    for (const w of ph.vocabulary) words.add(w.toLowerCase());
    for (const w of ph.trickyWords) words.add(w.toLowerCase());
  }
  // Always allow common function words used in tiny stories
  for (const w of ['a', 'the', 'and', 'is', 'it', 'in', 'on', 'at', 'to', 'of']) {
    words.add(w);
  }
  return words;
}

/**
 * Cumulative graphemes taught up to phase.
 * @param {number} phase
 * @returns {Set<string>}
 */
export function getPhaseGraphemes(phase) {
  const g = new Set();
  for (let p = 1; p <= phase; p += 1) {
    const ph = PHASES[p];
    if (!ph) continue;
    for (const x of ph.graphemes) g.add(x.toLowerCase());
  }
  return g;
}

/**
 * Tokenize a word into grapheme tiles with IPA (greedy longest match).
 * @param {string} word
 * @returns {GraphemeTile[]}
 */
export function tokenizeWord(word) {
  const clean = String(word || '').toLowerCase().replace(/[^a-z'-]/g, '');
  if (!clean) return [];

  // Split grapheme with silent e patterns (a-e etc.) — scaffold: treat as sequential
  const tiles = [];
  let i = 0;
  while (i < clean.length) {
    if (clean[i] === "'") {
      i += 1;
      continue;
    }
    let matched = false;
    for (const [g, ipa] of GRAPHEME_IPA) {
      if (clean.startsWith(g, i)) {
        const meta = PHONEMES[ipa] || { color: '#888888' };
        tiles.push({ grapheme: g, ipa, color: meta.color });
        i += g.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      tiles.push({ grapheme: clean[i], ipa: 'ə', color: '#888888' });
      i += 1;
    }
  }

  // Handle 'x' as /ks/
  return tiles.flatMap((t) => {
    if (t.grapheme === 'x') {
      return [
        { grapheme: 'x', ipa: 'k', color: PHONEMES.k.color },
        { grapheme: '', ipa: 's', color: PHONEMES.s.color },
      ].filter((x) => x.grapheme !== '' || x.ipa);
    }
    return [t];
  });
}

/**
 * @param {string} word
 * @returns {string[]}
 */
export function wordToPhonemes(word) {
  const key = String(word || '').toLowerCase().replace(/[^a-z']/g, '');
  if (PRONUNCIATIONS[key]) return [...PRONUNCIATIONS[key]];
  return tokenizeWord(key).map((t) => t.ipa).filter(Boolean);
}

/**
 * @param {string} word
 * @param {number} phase
 */
export function isWordAllowed(word, phase) {
  const key = String(word || '').toLowerCase().replace(/[^a-z']/g, '');
  if (!key) return true;
  const vocab = getPhaseVocabulary(phase);
  if (vocab.has(key)) return true;
  // Phase 4+ allow unknown CVC-ish words built from known graphemes
  if (phase >= 4) {
    const tiles = tokenizeWord(key);
    const graphemes = getPhaseGraphemes(Math.min(phase, 3) === 3 ? 3 : phase);
    // For phase 4, graphemes come from phases 2–3
    const allowedG = phase === 4 ? getPhaseGraphemes(3) : getPhaseGraphemes(phase);
    if (tiles.length && tiles.every((t) => !t.grapheme || allowedG.has(t.grapheme) || graphemes.has(t.grapheme))) {
      return true;
    }
  }
  return false;
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function extractWords(text) {
  return String(text || '')
    .toLowerCase()
    .match(/[a-z']+/g) || [];
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function expectedPhonemes(text) {
  const out = [];
  for (const w of extractWords(text)) {
    out.push(...wordToPhonemes(w));
  }
  return out;
}

/**
 * Highlight metadata for a full story text.
 * @param {string} text
 * @param {number} [phase]
 */
export function highlightText(text, phase = 2) {
  const parts = String(text || '').split(/(\s+|[.,!?;:"()])/);
  return parts.map((part) => {
    if (!part || /^[\s.,!?;:"()]+$/.test(part)) {
      return { type: 'sep', value: part };
    }
    const word = part;
    const tiles = tokenizeWord(word);
    return {
      type: 'word',
      value: word,
      allowed: isWordAllowed(word, phase),
      tiles,
      phonemes: wordToPhonemes(word),
    };
  });
}

/**
 * Words in text that violate the phase allowlist.
 * @param {string} text
 * @param {number} phase
 */
export function findDisallowedWords(text, phase) {
  return extractWords(text).filter((w) => !isWordAllowed(w, phase));
}

/**
 * Jaccard similarity J(A,B) = |A∩B| / |A∪B|
 * @param {Iterable<string>} a
 * @param {Iterable<string>} b
 */
export function jaccardSimilarity(a, b) {
  const A = new Set([...a].map((x) => String(x).toLowerCase()).filter(Boolean));
  const B = new Set([...b].map((x) => String(x).toLowerCase()).filter(Boolean));
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Map a grapheme / digraph / trigraph (GPC) to its taught IPA.
 * Uses longest-match so "sh", "igh", "air" resolve correctly — not letter-by-letter.
 * @param {string} grapheme
 * @returns {string}
 */
export function graphemeToIpa(grapheme) {
  const raw = String(grapheme || '').toLowerCase().trim();
  if (!raw) return 'ə';

  // Split digraphs written as a-e, i-e, o-e, u-e, e-e
  const split = raw.match(/^([aeiou])-e$/);
  if (split) {
    const map = { a: 'eɪ', e: 'iː', i: 'aɪ', o: 'əʊ', u: 'uː' };
    return map[split[1]] || 'ə';
  }

  const compact = raw.replace(/-/g, '');
  for (const [g, ipa] of GRAPHEME_IPA) {
    if (compact === g) return ipa;
  }
  // Fallback: first token of greedy tokenize
  return tokenizeWord(compact)[0]?.ipa || 'ə';
}

/**
 * Classify GPC length for UI grouping.
 * @param {string} grapheme
 */
export function classifyGrapheme(grapheme) {
  const g = String(grapheme || '').toLowerCase();
  if (/-e$/.test(g) || g.length >= 3) return 'trigraph';
  if (g.length === 2) return 'digraph';
  return 'single';
}

/**
 * UI tile strip for a phase guide.
 * @param {number} phase
 */
export function getPhaseGuide(phase) {
  const ph = getPhase(phase);
  if (!ph) return null;
  const graphemes = phase === 4
    ? [...getPhaseGraphemes(3)]
    : ph.graphemes.length
      ? ph.graphemes
      : [...getPhaseGraphemes(phase)];

  const tiles = graphemes.map((g) => {
    const ipa = graphemeToIpa(g);
    const meta = PHONEMES[ipa] || { color: '#888', name: g, ipa };
    const cue = getPhonemeCue(ipa);
    const kind = classifyGrapheme(g);
    return {
      grapheme: g,
      ipa: meta.ipa || ipa,
      name: meta.name || g,
      color: meta.color || '#888',
      examples: meta.examples || [g],
      kind,
      kindLabel:
        kind === 'single' ? 'GPC' : kind === 'digraph' ? 'Digraph' : 'Trigraph / split digraph',
      cue: cue.cue,
      tipSpeak: cue.tipSpeak,
      example: cue.example,
    };
  });

  return {
    ...ph,
    tiles,
    singles: tiles.filter((t) => t.kind === 'single'),
    digraphs: tiles.filter((t) => t.kind === 'digraph'),
    trigraphs: tiles.filter((t) => t.kind !== 'single' && t.kind !== 'digraph'),
    trickyWords: ph.trickyWords,
  };
}

export function listPhases() {
  return Object.values(PHASES).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
  }));
}

// ---------------------------------------------------------------------------
// Pronunciation coaching (Mrs Owl click-to-hear)
// ---------------------------------------------------------------------------

/**
 * Child-friendly UK cues + TTS-safe pure phoneme sounds (Letters and Sounds style).
 * IMPORTANT: `speak` must NEVER be a single alphabet letter — TTS will say the
 * letter name ("ess") which children hear wrongly (e.g. "yes yes yes").
 * Continuants use a long stretch (sssssss); stops use a clipped pure burst.
 */
export const PHONEME_CUES = {
  // Stops: avoid bare letters (TTS says “pee/tee/ess”). Use short clipped phonics forms.
  p: { cue: 'a quick lip pop — not the letter name “pee”', speak: 'puh', tipSpeak: 'like the start of pin', example: 'as in pin', stretch: false },
  b: { cue: 'a quick lip buzz — not “bee”', speak: 'buh', tipSpeak: 'like the start of bat', example: 'as in bat', stretch: false },
  t: { cue: 'a quick tongue tap — not “tee”', speak: 'tuh', tipSpeak: 'like the start of tap', example: 'as in tap', stretch: false },
  d: { cue: 'a quick voiced tap — not “dee”', speak: 'duh', tipSpeak: 'like the start of dog', example: 'as in dog', stretch: false },
  k: { cue: 'a quick throat click — not “kay”', speak: 'cuh', tipSpeak: 'like the start of cat', example: 'as in cat', stretch: false },
  g: { cue: 'a quick voiced throat sound — not “jee”', speak: 'guh', tipSpeak: 'like the start of gap', example: 'as in gap', stretch: false },
  tʃ: { cue: 'ch-ch like a train', speak: 'chuh', tipSpeak: 'like the start of chip', example: 'as in chip', stretch: false },
  dʒ: { cue: 'a soft j — not the letter name', speak: 'juh', tipSpeak: 'like the start of jam', example: 'as in jam', stretch: false },
  // Continuants: long stretch so TTS hisses/hums instead of naming the letter
  f: { cue: 'fffff — teeth on lip', speak: 'fffffff', tipSpeak: 'like a hissing fan', example: 'as in fan', stretch: true },
  v: { cue: 'vvvvv — teeth on lip, voice on', speak: 'vvvvvvv', tipSpeak: 'like a buzzing van', example: 'as in van', stretch: true },
  θ: { cue: 'thhhh — tongue between teeth, soft', speak: 'thhhhh', tipSpeak: 'like the start of thin', example: 'as in thin', stretch: true },
  ð: { cue: 'thhhh — tongue between teeth, buzzing', speak: 'thhhhh', tipSpeak: 'like the start of this', example: 'as in this', stretch: true },
  s: { cue: 'sssssss — like a snake (not “ess” / “yes”)', speak: 'sssssss', tipSpeak: 'like a snake', example: 'as in sun', stretch: true },
  z: { cue: 'zzzzzzz — like a bee', speak: 'zzzzzzz', tipSpeak: 'like a buzzing bee', example: 'as in zip', stretch: true },
  ʃ: { cue: 'shhhhh — quiet please', speak: 'shhhhhh', tipSpeak: 'like be quiet', example: 'as in ship', stretch: true },
  ʒ: { cue: 'zhhhh — soft buzzing sh', speak: 'zhhhhh', tipSpeak: 'like the middle of treasure', example: 'as in treasure', stretch: true },
  h: { cue: 'hhhhh — a soft breath', speak: 'hhhhh', tipSpeak: 'like a little breath', example: 'as in hat', stretch: true },
  m: { cue: 'mmmmmm — lips together, hum', speak: 'mmmmmmm', tipSpeak: 'like a yummy hum', example: 'as in man', stretch: true },
  n: { cue: 'nnnnnn — tongue up, hum', speak: 'nnnnnnn', tipSpeak: 'like a nose hum', example: 'as in net', stretch: true },
  ŋ: { cue: 'ngggg — back of nose hum', speak: 'ngggg', tipSpeak: 'like the end of ring', example: 'as in ring', stretch: true },
  l: { cue: 'llllll — tongue up behind teeth', speak: 'lllllll', tipSpeak: 'like a long l sound', example: 'as in leg', stretch: true },
  r: { cue: 'rrrrrr — gentle tongue curl', speak: 'rrrrrrr', tipSpeak: 'like a gentle growl', example: 'as in run', stretch: true },
  w: { cue: 'round-lip glide — not “double-u”', speak: 'wuh', tipSpeak: 'like the start of win', example: 'as in win', stretch: false },
  j: { cue: 'smile-glide — not “why”', speak: 'yuh', tipSpeak: 'like the start of yacht', example: 'as in yacht', stretch: false },
  æ: { cue: 'short a — as in apple', speak: 'aaaa', tipSpeak: 'like the middle of cat', example: 'as in cat', stretch: true },
  e: { cue: 'short e — as in egg', speak: 'eh eh', tipSpeak: 'like the middle of bed', example: 'as in bed', stretch: false },
  ɪ: { cue: 'short i — as in insect', speak: 'ih ih', tipSpeak: 'like the middle of pin', example: 'as in pin', stretch: false },
  ɒ: { cue: 'short o — as in orange', speak: 'o o', tipSpeak: 'like the middle of hot', example: 'as in hot', stretch: false },
  ʌ: { cue: 'short u — as in up', speak: 'uh uh', tipSpeak: 'like the middle of cup', example: 'as in cup', stretch: false },
  ʊ: { cue: 'short oo — as in book', speak: 'u u', tipSpeak: 'like the middle of book', example: 'as in book', stretch: false },
  ə: { cue: 'a soft little uh', speak: 'uh', tipSpeak: 'like the end of sofa', example: 'as in sofa', stretch: false },
  iː: { cue: 'long ee — smile sound', speak: 'eeeeee', tipSpeak: 'like the end of tree', example: 'as in tree', stretch: true },
  ɑː: { cue: 'long ah — open mouth', speak: 'aaaaah', tipSpeak: 'like the middle of car', example: 'as in car', stretch: true },
  ɔː: { cue: 'long or — round lips', speak: 'awwww', tipSpeak: 'like the middle of for', example: 'as in for', stretch: true },
  uː: { cue: 'long oo — as in moon', speak: 'oooooo', tipSpeak: 'like the middle of moon', example: 'as in moon', stretch: true },
  ɜː: { cue: 'long ur', speak: 'urrrr', tipSpeak: 'like the middle of burn', example: 'as in burn', stretch: true },
  eɪ: { cue: 'ay — as in rain', speak: 'ay', tipSpeak: 'like the middle of rain', example: 'as in rain', stretch: false },
  aɪ: { cue: 'igh — say eye', speak: 'eye', tipSpeak: 'like the middle of night', example: 'as in night', stretch: false },
  ɔɪ: { cue: 'oy — as in coin', speak: 'oy', tipSpeak: 'like the middle of coin', example: 'as in coin', stretch: false },
  aʊ: { cue: 'ow — as in cow', speak: 'ow', tipSpeak: 'like the middle of cow', example: 'as in cow', stretch: false },
  əʊ: { cue: 'oh — as in boat', speak: 'oh', tipSpeak: 'like the middle of boat', example: 'as in boat', stretch: false },
  ɪə: { cue: 'ear', speak: 'ear', tipSpeak: 'like the word hear', example: 'as in hear', stretch: false },
  eə: { cue: 'air', speak: 'air', tipSpeak: 'like the word fair', example: 'as in fair', stretch: false },
  ʊə: { cue: 'ure', speak: 'oor', tipSpeak: 'like the end of pure', example: 'as in pure', stretch: false },
};

/** Enrich PHONEMES in place — engine remains the runtime source of truth. */
(function enrichPhonemes() {
  for (const ipa of ALL_IPA) {
    const base = PHONEMES[ipa];
    const cue = PHONEME_CUES[ipa] || {};
    const category = VOWEL_IPA.includes(ipa) ? 'vowel' : 'consonant';
    Object.assign(base, {
      category,
      phase: PHONEME_PHASE[ipa] ?? (category === 'vowel' ? 3 : 2),
      exampleWords: PHONEME_EXAMPLE_WORDS[ipa] || [],
      blend: PHONEME_BLENDS[ipa] || [ipa],
      audio: PHONEME_AUDIO_RECIPES[ipa] || {
        kind: 'tone',
        freqs: [440],
        duration: 0.4,
        type: 'sine',
        gain: 0.08,
      },
      /** Real recorded phoneme clip (preferred over synthetic `audio` recipe) */
      audioUrl: phonemeAudioUrl(ipa),
      audioSlug: IPA_AUDIO_SLUG[ipa] || '',
      cue: cue.cue || `the sound /${ipa}/`,
      tipSpeak: cue.tipSpeak || 'listen and copy',
      speak: cue.speak || ipa,
      stretch: Boolean(cue.stretch),
      example:
        cue.example ||
        (PHONEME_EXAMPLE_WORDS[ipa]?.[0] ? `as in ${PHONEME_EXAMPLE_WORDS[ipa][0]}` : ''),
    });
  }
})();

/**
 * Full phoneme record from the engine (colours, blend, audio, phase, examples).
 * @param {string} ipa
 * @returns {PhonemeMeta|null}
 */
export function getPhoneme(ipa) {
  return PHONEMES[ipa] || null;
}

/**
 * Pure sound string for TTS tips only (never used for the phoneme itself).
 * @param {string} ipa
 */
export function phonemeSpeakSound(ipa) {
  const info = getPhonemeCue(ipa);
  return info.speak;
}

/**
 * @param {string} ipa
 */
export function getPhonemeCue(ipa) {
  const meta = PHONEMES[ipa];
  if (!meta) {
    return {
      ipa,
      name: ipa,
      color: '#888888',
      cue: `the sound /${ipa}/`,
      speak: 'uh',
      tipSpeak: 'listen and copy',
      example: '',
      stretch: false,
      blend: [ipa],
      exampleWords: [],
      phase: 2,
      audio: { kind: 'tone', freqs: [440], duration: 0.4, type: 'sine', gain: 0.08 },
    };
  }
  return {
    ipa: meta.ipa,
    name: meta.name,
    color: meta.color,
    cue: meta.cue,
    speak: meta.speak,
    tipSpeak: meta.tipSpeak,
    example: meta.example,
    stretch: meta.stretch,
      blend: meta.blend,
      exampleWords: meta.exampleWords,
      phase: meta.phase,
      category: meta.category,
      audio: meta.audio,
      audioUrl: meta.audioUrl,
      audioSlug: meta.audioSlug,
      examples: meta.examples,
    };
  }

/** All 44 phoneme records as an array (stable order). */
export function listAllPhonemes() {
  return ALL_IPA.map((ipa) => getPhonemeCue(ipa));
}

/**
 * Split text into sentences with global word-index ranges for highlighting.
 * @param {string} text
 * @param {number} [phase]
 */
export function splitSentences(text, phase = 2) {
  const parts = highlightText(text, phase);
  const sentences = [];
  let current = { text: '', wordIndexes: [], words: [] };
  let wordIndex = -1;

  const flush = () => {
    const trimmed = current.text.trim();
    if (!trimmed && current.wordIndexes.length === 0) return;
    sentences.push({
      index: sentences.length,
      text: trimmed,
      wordIndexes: [...current.wordIndexes],
      words: [...current.words],
      startWordIndex: current.wordIndexes[0] ?? -1,
      endWordIndex: current.wordIndexes[current.wordIndexes.length - 1] ?? -1,
    });
    current = { text: '', wordIndexes: [], words: [] };
  };

  for (const part of parts) {
    if (part.type === 'word') {
      wordIndex += 1;
      current.wordIndexes.push(wordIndex);
      current.words.push(part.value);
      current.text += part.value;
      continue;
    }
    current.text += part.value || '';
    if (/[.!?]/.test(part.value || '')) {
      flush();
    }
  }
  flush();
  return sentences.filter((s) => s.words.length > 0);
}

/**
 * Build a pronunciation lesson payload for phoneme / word / sentence / story.
 * @param {{ type: string, value?: string, ipa?: string, grapheme?: string, text?: string, phase?: number }} input
 */
export function buildPronunciationLesson(input) {
  const type = input.type || 'word';
  const phase = Number(input.phase) || 2;

  if (type === 'phoneme') {
    const ipa = input.ipa || tokenizeWord(input.grapheme || input.value || '')[0]?.ipa || 'ə';
    const grapheme = input.grapheme || input.value || getPhonemeCue(ipa).name;
    const info = getPhonemeCue(ipa);
    const sound = phonemeSpeakSound(ipa);
    // Speak ONLY the pure sound, then a tip — never "s as in sun" (TTS says letter name “ess”).
    const speakText = sound;
    const message = `Listen: ${sound} — ${info.cue}. The letters "${grapheme}" make this sound.`;
    return {
      type: 'phoneme',
      message,
      speakText,
      display: {
        grapheme,
        ipa,
        cue: info.cue,
        example: info.example,
        tipSpeak: info.tipSpeak,
        color: info.color,
        sound,
      },
      steps: [
        {
          kind: 'phoneme',
          pure: true,
          grapheme,
          ipa,
          stretch: info.stretch,
          durationMs: info.stretch ? 1200 : 650,
        },
        {
          kind: 'tip',
          grapheme,
          ipa,
          speak: info.tipSpeak,
          durationMs: 1100,
        },
      ],
    };
  }

  if (type === 'word') {
    const word = String(input.value || input.text || '').trim();
    const tiles = tokenizeWord(word);
    const phonemes = wordToPhonemes(word);
    const speakText = word;
    const message = `Let's sound out "${word}": ${phonemes.map((p) => `/${p}/`).join(' ')}. Now blend: ${word}.`;
    const steps = [
      ...tiles
        .filter((t) => t.grapheme)
        .map((t, i) => {
          const info = getPhonemeCue(t.ipa);
          return {
            kind: 'tile',
            pure: true,
            tileIndex: i,
            grapheme: t.grapheme,
            ipa: t.ipa,
            stretch: info.stretch,
            durationMs: info.stretch ? 850 : 500,
          };
        }),
      { kind: 'word', speak: word, durationMs: Math.max(900, word.length * 180) },
    ];
    return {
      type: 'word',
      message,
      speakText,
      display: { word, tiles, phonemes },
      steps,
    };
  }

  if (type === 'sentence' || type === 'story') {
    const text = String(input.text || input.value || '').trim();
    const words = extractWords(text);
    const speakText = text;
    const message =
      type === 'story'
        ? 'Listen to Mrs Owl read the whole story. Follow the glowing words.'
        : 'Listen to this sentence. Follow the glowing words with your eyes.';
    const steps = words.map((w, i) => ({
      kind: 'word',
      wordOffset: i,
      speak: w,
      durationMs: Math.max(420, w.length * 160 + 200),
    }));
    return {
      type,
      message,
      speakText,
      display: { text, words },
      steps,
      sentences: splitSentences(text, phase),
    };
  }

  return buildPronunciationLesson({ ...input, type: 'word' });
}

export default {
  PHONEMES,
  ALL_IPA,
  CONSONANT_IPA,
  VOWEL_IPA,
  PHASES,
  PHONEME_CUES,
  getPhase,
  getPhaseVocabulary,
  getPhaseGraphemes,
  tokenizeWord,
  wordToPhonemes,
  isWordAllowed,
  extractWords,
  expectedPhonemes,
  highlightText,
  findDisallowedWords,
  jaccardSimilarity,
  getPhaseGuide,
  listPhases,
  graphemeToIpa,
  classifyGrapheme,
  getPhoneme,
  getPhonemeCue,
  listAllPhonemes,
  phonemeSpeakSound,
  splitSentences,
  buildPronunciationLesson,
};
