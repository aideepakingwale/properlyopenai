/**
 * Maps IPA symbols → safe audio filenames under /phonemes/{slug}.mp3
 * Slugs are lowercase ASCII and unique on case-insensitive filesystems (Windows).
 */

/** @type {Record<string, string>} */
export const IPA_AUDIO_SLUG = {
  p: 'p',
  b: 'b',
  t: 't',
  d: 'd',
  k: 'k',
  g: 'g',
  tʃ: 'tsh',
  dʒ: 'dzh',
  f: 'f',
  v: 'v',
  θ: 'theta',
  ð: 'eth',
  s: 's',
  z: 'z',
  ʃ: 'esh',
  ʒ: 'ezh',
  h: 'h',
  m: 'm',
  n: 'n',
  ŋ: 'eng',
  l: 'l',
  r: 'r',
  w: 'w',
  j: 'yod',
  æ: 'ash',
  e: 'e',
  ɪ: 'short-i',
  ɒ: 'short-o',
  ʌ: 'strut',
  ʊ: 'short-u',
  ə: 'schwa',
  iː: 'fleece',
  ɑː: 'palm',
  ɔː: 'thought',
  uː: 'goose',
  ɜː: 'nurse',
  eɪ: 'face',
  aɪ: 'price',
  ɔɪ: 'choice',
  aʊ: 'mouth',
  əʊ: 'goat',
  ɪə: 'near',
  eə: 'square',
  ʊə: 'cure',
};

/**
 * @param {string} ipa
 * @returns {string} public URL path
 */
/** Bump when phoneme assets change so browsers reload real recordings. */
const AUDIO_ASSET_VERSION = '2';

export function phonemeAudioUrl(ipa) {
  const slug = IPA_AUDIO_SLUG[ipa];
  if (!slug) return '';
  return `/phonemes/${slug}.mp3?v=${AUDIO_ASSET_VERSION}`;
}
