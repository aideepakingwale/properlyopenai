const CUES = {
  lipPop: {
    label: 'Lip pop',
    tip: 'Close lips, then pop them open.',
    asset: 'lip-pop.webp',
    motion: 'press-pop',
    group: ['p', 'b', 'm'],
  },
  teethLip: {
    label: 'Teeth on lip',
    tip: 'Top teeth gently touch bottom lip.',
    asset: 'teeth-lip.webp',
    motion: 'teeth-down',
    group: ['f', 'v'],
  },
  tongueTeeth: {
    label: 'Tongue peeks out',
    tip: 'Tongue sits between the teeth.',
    asset: 'tongue-teeth.webp',
    motion: 'tongue-forward',
    group: ['θ', 'ð'],
  },
  tongueTap: {
    label: 'Tongue tap',
    tip: 'Tongue taps behind the top teeth.',
    asset: 'tongue-tap.webp',
    motion: 'tongue-up',
    group: ['t', 'd', 'n', 'l'],
  },
  throat: {
    label: 'Back of mouth',
    tip: 'Sound starts at the back of the mouth.',
    asset: 'open-vowel.webp',
    motion: 'back-sound',
    group: ['k', 'g', 'ŋ'],
  },
  round: {
    label: 'Round lips',
    tip: 'Make a small round mouth.',
    asset: 'round-lips.webp',
    motion: 'round-in',
    group: ['w', 'uː', 'ʊ', 'ɔː', 'ɒ', 'ɔɪ', 'əʊ', 'ʊə'],
  },
  smile: {
    label: 'Smile sound',
    tip: 'Smile wide and keep the tongue high.',
    asset: 'open-vowel.webp',
    motion: 'smile-wide',
    group: ['iː', 'ɪ', 'e', 'eɪ', 'j', 'ɪə', 'eə'],
  },
  open: {
    label: 'Open mouth',
    tip: 'Open the mouth and let the sound out.',
    asset: 'open-vowel.webp',
    motion: 'open-down',
    group: ['æ', 'ɑː', 'ʌ', 'aɪ', 'aʊ', 'ə', 'ɜː'],
  },
  hush: {
    label: 'Quiet lips',
    tip: 'Lips forward, air slides out.',
    asset: 'round-lips.webp',
    motion: 'air-out',
    group: ['s', 'z', 'ʃ', 'ʒ', 'tʃ', 'dʒ', 'h', 'r'],
  },
};

export default function MouthCue({ ipa, grapheme }) {
  const cue = findCue(ipa);
  const shape = cue?.key || 'open';
  const asset = `/images/mouth-cues/${cue.asset}`;
  return (
    <div
      className={`mouth-cue mouth-cue-${shape} mouth-motion-${cue.motion}`}
      aria-label={`Mouth position for /${ipa || ''}/`}
    >
      <div className="mouth-art" aria-hidden="true">
        <img src={asset} alt="" loading="lazy" />
        <span className="motion-ring" />
        <span className="motion-arrow arrow-main" />
        <span className="motion-arrow arrow-second" />
        <span className="motion-dot dot-one" />
        <span className="motion-dot dot-two" />
        <span className="motion-dot dot-three" />
      </div>
      <div className="mouth-copy">
        <span className="mouth-ipa">/{ipa || '?'}/</span>
        <strong>{cue?.label || 'Watch the mouth'}</strong>
        <p>{cue?.tip || 'Listen, look, then copy the sound.'}</p>
        {grapheme && <small>Letters: {grapheme}</small>}
      </div>
    </div>
  );
}

function findCue(ipa) {
  for (const [key, cue] of Object.entries(CUES)) {
    if (cue.group.includes(ipa)) return { ...cue, key };
  }
  return { ...CUES.open, key: 'open' };
}
