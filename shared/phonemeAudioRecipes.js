/**
 * Web Audio synthesis recipes for all 44 IPA phonemes.
 * Imported into phonicsEngine so the engine remains the single source of truth
 * (each PHONEMES[ipa].audio points here).
 */

/** @type {Record<string, object>} */
export const PHONEME_AUDIO_RECIPES = {
  p: { kind: 'burst', duration: 0.06, highpass: 1200, gain: 0.28 },
  b: { kind: 'burst', duration: 0.07, highpass: 400, gain: 0.3 },
  t: { kind: 'burst', duration: 0.05, highpass: 2500, gain: 0.3 },
  d: { kind: 'burst', duration: 0.06, highpass: 900, gain: 0.28 },
  k: { kind: 'burst', duration: 0.06, highpass: 1800, gain: 0.3 },
  g: { kind: 'burst', duration: 0.07, highpass: 500, gain: 0.28 },
  tʃ: { kind: 'noise', duration: 0.28, highpass: 1800, bandpass: 2500, q: 0.8, gain: 0.2 },
  dʒ: { kind: 'noise', duration: 0.28, highpass: 900, bandpass: 1600, q: 0.7, gain: 0.2 },
  f: { kind: 'noise', duration: 0.9, highpass: 1400, lowpass: 7000, gain: 0.16 },
  v: { kind: 'voiced-fric', duration: 0.85, highpass: 500, tone: 120, gain: 0.12 },
  θ: { kind: 'noise', duration: 0.85, highpass: 2200, lowpass: 8000, gain: 0.14 },
  ð: { kind: 'voiced-fric', duration: 0.85, highpass: 800, tone: 130, gain: 0.12 },
  s: { kind: 'noise', duration: 1.05, highpass: 4000, lowpass: 11000, gain: 0.18 },
  z: { kind: 'voiced-fric', duration: 1.0, highpass: 3000, tone: 140, gain: 0.13 },
  ʃ: { kind: 'noise', duration: 1.0, highpass: 1800, lowpass: 5500, bandpass: 2800, q: 0.6, gain: 0.18 },
  ʒ: { kind: 'voiced-fric', duration: 0.95, highpass: 1600, tone: 150, gain: 0.13 },
  h: { kind: 'noise', duration: 0.55, highpass: 600, lowpass: 4000, gain: 0.1 },
  m: { kind: 'tone', freqs: [140, 280], duration: 0.85, type: 'sine', gain: 0.16 },
  n: { kind: 'tone', freqs: [160, 320], duration: 0.85, type: 'sine', gain: 0.15 },
  ŋ: { kind: 'tone', freqs: [130, 260], duration: 0.85, type: 'sine', gain: 0.15 },
  l: { kind: 'tone', freqs: [220, 900], duration: 0.75, type: 'triangle', gain: 0.12 },
  r: { kind: 'tone', freqs: [180, 700], duration: 0.75, type: 'sawtooth', gain: 0.08, vibrato: 4 },
  w: { kind: 'glide', from: [250, 500], to: [300, 700], duration: 0.35 },
  j: { kind: 'glide', from: [280, 2200], to: [260, 1800], duration: 0.32 },
  æ: { kind: 'tone', freqs: [700, 1600], duration: 0.7, type: 'sawtooth', gain: 0.09 },
  e: { kind: 'tone', freqs: [550, 1800], duration: 0.65, type: 'sawtooth', gain: 0.09 },
  ɪ: { kind: 'tone', freqs: [400, 2000], duration: 0.55, type: 'sawtooth', gain: 0.09 },
  ɒ: { kind: 'tone', freqs: [600, 900], duration: 0.65, type: 'sawtooth', gain: 0.09 },
  ʌ: { kind: 'tone', freqs: [650, 1200], duration: 0.6, type: 'sawtooth', gain: 0.09 },
  ʊ: { kind: 'tone', freqs: [400, 900], duration: 0.55, type: 'sawtooth', gain: 0.09 },
  ə: { kind: 'tone', freqs: [500, 1400], duration: 0.45, type: 'triangle', gain: 0.08 },
  iː: { kind: 'tone', freqs: [300, 2300], duration: 0.9, type: 'sawtooth', gain: 0.09 },
  ɑː: { kind: 'tone', freqs: [700, 1100], duration: 0.95, type: 'sawtooth', gain: 0.09 },
  ɔː: { kind: 'tone', freqs: [500, 850], duration: 0.95, type: 'sawtooth', gain: 0.09 },
  uː: { kind: 'tone', freqs: [300, 800], duration: 0.95, type: 'sawtooth', gain: 0.09 },
  ɜː: { kind: 'tone', freqs: [500, 1500], duration: 0.9, type: 'sawtooth', gain: 0.09 },
  eɪ: { kind: 'diphthong', a: [550, 1800], b: [350, 2200], duration: 0.75 },
  aɪ: { kind: 'diphthong', a: [750, 1200], b: [350, 2100], duration: 0.8 },
  ɔɪ: { kind: 'diphthong', a: [500, 900], b: [350, 2000], duration: 0.8 },
  aʊ: { kind: 'diphthong', a: [700, 1200], b: [400, 900], duration: 0.8 },
  əʊ: { kind: 'diphthong', a: [500, 1000], b: [350, 800], duration: 0.8 },
  ɪə: { kind: 'diphthong', a: [400, 2000], b: [500, 1400], duration: 0.75 },
  eə: { kind: 'diphthong', a: [550, 1800], b: [500, 1400], duration: 0.75 },
  ʊə: { kind: 'diphthong', a: [400, 900], b: [500, 1400], duration: 0.75 },
};

/** Blend-component IPA arrays (diphthongs glide; monophthongs are single-element). */
export const PHONEME_BLENDS = {
  p: ['p'], b: ['b'], t: ['t'], d: ['d'], k: ['k'], g: ['g'],
  tʃ: ['t', 'ʃ'], dʒ: ['d', 'ʒ'],
  f: ['f'], v: ['v'], θ: ['θ'], ð: ['ð'], s: ['s'], z: ['z'],
  ʃ: ['ʃ'], ʒ: ['ʒ'], h: ['h'],
  m: ['m'], n: ['n'], ŋ: ['ŋ'], l: ['l'], r: ['r'], w: ['w'], j: ['j'],
  æ: ['æ'], e: ['e'], ɪ: ['ɪ'], ɒ: ['ɒ'], ʌ: ['ʌ'], ʊ: ['ʊ'], ə: ['ə'],
  iː: ['iː'], ɑː: ['ɑː'], ɔː: ['ɔː'], uː: ['uː'], ɜː: ['ɜː'],
  eɪ: ['e', 'ɪ'], aɪ: ['ɑ', 'ɪ'], ɔɪ: ['ɔ', 'ɪ'],
  aʊ: ['a', 'ʊ'], əʊ: ['ə', 'ʊ'],
  ɪə: ['ɪ', 'ə'], eə: ['e', 'ə'], ʊə: ['ʊ', 'ə'],
};

/** Classroom example words per phoneme */
export const PHONEME_EXAMPLE_WORDS = {
  p: ['pin', 'map', 'cup'], b: ['bat', 'rub', 'big'], t: ['tap', 'cat', 'sit'],
  d: ['dog', 'red', 'lid'], k: ['cat', 'kit', 'duck'], g: ['gap', 'dog', 'big'],
  tʃ: ['chip', 'much', 'catch'], dʒ: ['jam', 'jump', 'edge'],
  f: ['fan', 'off', 'fish'], v: ['van', 'have'], θ: ['thin', 'moth'], ð: ['this', 'that'],
  s: ['sun', 'sat', 'miss'], z: ['zip', 'buzz'], ʃ: ['ship', 'fish'], ʒ: ['treasure'],
  h: ['hat', 'hot'], m: ['man', 'mum'], n: ['net', 'sun'], ŋ: ['ring', 'sing'],
  l: ['leg', 'bell'], r: ['run', 'red'], w: ['win', 'wet'], j: ['yes', 'yacht'],
  æ: ['cat', 'sat', 'apple'], e: ['bed', 'pen', 'egg'], ɪ: ['pin', 'sit', 'insect'],
  ɒ: ['hot', 'dog', 'orange'], ʌ: ['cup', 'sun', 'up'], ʊ: ['book', 'look'],
  ə: ['the', 'sofa'], iː: ['tree', 'see', 'bee'], ɑː: ['car', 'park'],
  ɔː: ['for', 'born'], uː: ['moon', 'boot'], ɜː: ['burn', 'her'],
  eɪ: ['rain', 'day'], aɪ: ['night', 'pie'], ɔɪ: ['coin', 'boy'],
  aʊ: ['cow', 'out'], əʊ: ['boat', 'go'], ɪə: ['ear', 'hear'],
  eə: ['air', 'fair'], ʊə: ['pure', 'sure'],
};

/** Phase when the phoneme is typically first taught (Letters and Sounds) */
export const PHONEME_PHASE = {
  s: 2, a: 2, æ: 2, t: 2, p: 2, ɪ: 2, n: 2, m: 2, d: 2, g: 2, ɒ: 2, k: 2,
  e: 2, ʌ: 2, r: 2, h: 2, b: 2, f: 2, l: 2,
  dʒ: 3, v: 3, w: 3, j: 3, z: 3, tʃ: 3, ʃ: 3, θ: 3, ð: 3, ŋ: 3,
  eɪ: 3, iː: 3, aɪ: 3, əʊ: 3, uː: 3, ʊ: 3, ɑː: 3, ɔː: 3, ɜː: 3,
  aʊ: 3, ɔɪ: 3, ɪə: 3, eə: 3, ʊə: 3, ə: 3, ʒ: 5,
};
