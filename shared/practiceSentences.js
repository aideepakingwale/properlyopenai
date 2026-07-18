/**
 * Curated Letters and Sounds practice sentences for reading + assessment.
 * Used when generating a practice pack (no OpenAI required).
 */

/** @type {Record<number, string[]>} */
export const PRACTICE_SENTENCES = {
  2: [
    'A cat sat on a mat.',
    'The cat had a nap.',
    'Dad sat on a log.',
    'A big dog ran to the cat.',
    'The cat hid in a bag.',
    'I can go into the tent.',
  ],
  3: [
    'She can see a ship on the sea.',
    'The fish can swim.',
    'We hear an owl at night.',
    'They all look at the moon.',
    'He has a wish for a boat.',
    'My sheep is in the barn.',
  ],
  4: [
    'A frog can jump from a plant.',
    'We stop and clap.',
    'Best friends bring a snack.',
    'Then we splash and grin.',
    'The crab hid in the sand.',
    'What a strong swing!',
  ],
  5: [
    'Today we play by the sea.',
    'We make a boat and sail.',
    'They shout with joy.',
    'I like the time at home.',
    'The girl saw a bird first.',
    'Could you look at the phone?',
  ],
};

/**
 * @param {number} phase
 * @returns {string[]}
 */
export function getPracticeSentences(phase) {
  const p = Number(phase) || 2;
  return [...(PRACTICE_SENTENCES[p] || PRACTICE_SENTENCES[2])];
}

/**
 * Build a practice pack as story-shaped content (title + joined text).
 * @param {number} phase
 * @param {{ count?: number, theme?: string }} [opts]
 */
export function buildPracticePack(phase, opts = {}) {
  const p = Number(phase) || 2;
  const all = getPracticeSentences(p);
  const count = Math.min(opts.count || all.length, all.length);
  const sentences = all.slice(0, count);
  const theme = opts.theme || 'practice';
  return {
    phase: p,
    theme,
    title: `Phase ${p} practice sentences`,
    text: sentences.join(' '),
    sentences,
    kind: 'practice',
  };
}
