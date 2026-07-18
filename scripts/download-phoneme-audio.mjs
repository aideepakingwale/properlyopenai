/**
 * Download real British-English isolated phoneme MP3s into client/public/phonemes/.
 * Source: https://github.com/xiaozhah/phoneme_audio (isolation clips)
 *
 * Usage: node scripts/download-phoneme-audio.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ALL_IPA } from '../shared/phonicsEngine.js';
import { IPA_AUDIO_SLUG } from '../shared/phonemeAudioMap.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../client/public/phonemes');
const BASE = 'https://raw.githubusercontent.com/xiaozhah/phoneme_audio/main/audio';

fs.mkdirSync(outDir, { recursive: true });

/** Fallback when our IPA symbol filename differs slightly in the upstream set */
const UPSTREAM_ALIASES = {
  // upstream uses plain "i" for some short-i materials; we prefer ɪ
  ɪ: ['ɪ', 'i'],
  uː: ['uː', 'u'],
};

async function fetchOne(ipa, slug) {
  const candidates = UPSTREAM_ALIASES[ipa] || [ipa];
  let lastErr;
  for (const symbol of candidates) {
    const url = `${BASE}/${encodeURIComponent(symbol)}_isolation.mp3`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        lastErr = new Error(`${res.status} ${url}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const dest = path.join(outDir, `${slug}.mp3`);
      fs.writeFileSync(dest, buf);
      console.log('OK', ipa, '->', path.basename(dest), `(${buf.length} bytes)`);
      return true;
    } catch (err) {
      lastErr = err;
    }
  }
  console.warn('FAIL', ipa, lastErr?.message || lastErr);
  return false;
}

let ok = 0;
for (const ipa of ALL_IPA) {
  const slug = IPA_AUDIO_SLUG[ipa];
  if (!slug) {
    console.warn('No slug for', ipa);
    continue;
  }
  // eslint-disable-next-line no-await-in-loop
  if (await fetchOne(ipa, slug)) ok += 1;
}

fs.writeFileSync(
  path.join(outDir, 'ATTRIBUTION.txt'),
  `British English isolated phoneme recordings
Downloaded for Properly educational use from:
https://github.com/xiaozhah/phoneme_audio
Original dictionary audio attribution per that project (Oxford Dictionary).
Replace with licensed classroom recordings for commercial distribution.
Generated: ${new Date().toISOString()}
Files: ${ok} / ${ALL_IPA.length}
`,
);

console.log(`\nDone: ${ok}/${ALL_IPA.length} phoneme files in ${outDir}`);
if (ok < ALL_IPA.length) process.exitCode = 1;
