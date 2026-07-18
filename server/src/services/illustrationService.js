import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { config } from '../config.js';

/** Bump when prompt / model defaults change so old SVG placeholders are not reused. */
const CACHE_VERSION = 'v5';
const INDEX_NAME = 'cache-index.json';

/**
 * Image generation is metered OpenAI API usage.
 * Always cache by scene hash; prefer low quality for lighter/cheaper kids art.
 */
const DEFAULT_MODEL_CHAIN = ['gpt-image-1-mini', 'gpt-image-1', 'dall-e-2'];

/** @type {OpenAI|null} */
let imageClient = null;

function getImageClient() {
  const key = (config.openaiApiKey || '').trim();
  if (!key) return null;
  // Story art intentionally uses the real key when one is configured.
  if (!imageClient) {
    imageClient = new OpenAI({ apiKey: key });
  }
  return imageClient;
}

function imagesDir() {
  const dir = path.join(config.storageDir, 'images');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function indexPath() {
  return path.join(imagesDir(), INDEX_NAME);
}

function readIndex() {
  try {
    return JSON.parse(fs.readFileSync(indexPath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeIndex(index) {
  fs.writeFileSync(indexPath(), JSON.stringify(index, null, 2), 'utf8');
}

function normalizeKeyPart(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Stable cache key for a story scene so repeat generations reuse the file.
 */
export function illustrationCacheKey({ title, theme, text, phase = 2 }) {
  const scene = sceneSummary(text);
  const payload = [
    CACHE_VERSION,
    `phase:${Number(phase) || 2}`,
    `theme:${normalizeKeyPart(theme)}`,
    `title:${normalizeKeyPart(title)}`,
    `scene:${normalizeKeyPart(scene)}`,
  ].join('|');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

const VISUAL_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'big',
  'can',
  'did',
  'for',
  'from',
  'get',
  'got',
  'had',
  'has',
  'have',
  'he',
  'her',
  'him',
  'his',
  'i',
  'in',
  'is',
  'it',
  'its',
  'little',
  'my',
  'of',
  'on',
  'ran',
  'run',
  'said',
  'saw',
  'she',
  'the',
  'then',
  'this',
  'to',
  'was',
  'we',
  'went',
  'with',
]);

function visualSignature({ title, theme, text }) {
  const source = `${title || ''} ${sceneSummary(text)} ${theme || ''}`.toLowerCase();
  const words = source
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/s$/, ''))
    .filter((word) => word.length > 1 && !VISUAL_STOPWORDS.has(word));
  const unique = [...new Set(words)];
  return unique.slice(0, 10).join('-') || normalizeKeyPart(theme) || 'storybook-scene';
}

/**
 * Scene reuse key: reuses only when phase, theme, and visible story subjects match.
 * This is cheaper than regenerating every story while staying relevant to the plot.
 */
export function illustrationSceneCacheKey({ title, theme, text, phase = 2 }) {
  const payload = [
    CACHE_VERSION,
    'reuse:scene',
    `phase:${Number(phase) || 2}`,
    `theme:${normalizeKeyPart(theme) || 'adventure'}`,
    `visual:${visualSignature({ title, theme, text })}`,
  ].join('|');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/** First 1–2 sentences / short scene cue for the prompt + cache. */
function sceneSummary(text) {
  const clean = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return 'a friendly outdoor adventure for children';
  const parts = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, 2).join(' ').slice(0, 220);
}

function buildKidsPrompt({ title, theme, text, phase }) {
  const scene = sceneSummary(text);
  const visualCue = visualSignature({ title, theme, text }).replace(/-/g, ', ');
  return [
    'Cheerful UK early-reader picture-book illustration for children aged 4 to 7.',
    'Style: warm semi-realistic storybook painting, natural textures, expressive friendly characters, bright daylight, soft edges, rich but uncluttered details.',
    'Composition: one clear scene with the main character large and easy to recognise, suitable as a small story thumbnail.',
    'Avoid flat vector art, geometric icons, abstract shapes, generic landscapes, dark mood, scary faces, violence, 3D CGI, or adult themes.',
    'No text, letters, numbers, captions, logos, or watermarks anywhere in the image.',
    'Depict the actual story events and visible objects. If the chosen topic and story conflict, prioritise the story scene.',
    `Letters and Sounds Phase ${Number(phase) || 2} storybook mood.`,
    `Story title (do not write it in the image): ${title || 'My Story'}.`,
    `Chosen child topic/theme for background mood only: ${theme || 'adventure'}.`,
    `Scene to depict exactly: ${scene}`,
    `Important visible subjects: ${visualCue}.`,
  ].join(' ');
}

function writeSvgPlaceholder({ title, theme, text, phase, hash }) {
  const dir = imagesDir();
  const filename = `${hash || crypto.randomUUID()}.svg`;
  const filepath = path.join(dir, filename);
  if (fs.existsSync(filepath)) {
    return { url: `/storage/images/${filename}`, path: filepath, mock: true, cached: true };
  }

  const signature = visualSignature({ title, theme, text });
  const isDogMud = /\bdog\b/.test(signature) && /\bmud\b/.test(signature);
  const mainScene = isDogMud
    ? `
  <ellipse cx="360" cy="590" rx="260" ry="80" fill="#8D6E63" opacity="0.55"/>
  <ellipse cx="285" cy="555" rx="84" ry="42" fill="#F6C28B" stroke="#6D4C41" stroke-width="8"/>
  <circle cx="370" cy="520" r="44" fill="#F6C28B" stroke="#6D4C41" stroke-width="8"/>
  <circle cx="395" cy="520" r="22" fill="#6D4C41"/>
  <circle cx="386" cy="512" r="6" fill="#1F2937"/>
  <circle cx="336" cy="512" r="8" fill="#1F2937"/>
  <path d="M214 548 C165 510 150 486 172 468 C202 484 225 512 248 545" fill="none" stroke="#F6C28B" stroke-width="18" stroke-linecap="round"/>
  <path d="M250 588 L222 640 M305 590 L294 646 M350 586 L374 636" stroke="#6D4C41" stroke-width="14" stroke-linecap="round"/>
  <circle cx="200" cy="618" r="18" fill="#795548" opacity="0.7"/>
  <circle cx="456" cy="615" r="14" fill="#795548" opacity="0.6"/>`
    : `
  <ellipse cx="384" cy="560" rx="260" ry="70" fill="#81C784" opacity="0.85"/>
  <circle cx="312" cy="430" r="58" fill="#FFF8E1" stroke="#8D6E63" stroke-width="5"/>
  <ellipse cx="312" cy="410" rx="28" ry="34" fill="#8D6E63"/>
  <circle cx="296" cy="432" r="5" fill="#1B4332"/>
  <circle cx="328" cy="432" r="5" fill="#1B4332"/>
  <path d="M250 520 C310 470 430 470 510 535" fill="none" stroke="#4DB6AC" stroke-width="28" stroke-linecap="round" opacity="0.65"/>`;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="0 0 768 768">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#B8E0F6"/>
      <stop offset="55%" stop-color="#FFF6D8"/>
      <stop offset="100%" stop-color="#C8E6C9"/>
    </linearGradient>
  </defs>
  <rect width="768" height="768" fill="url(#sky)"/>
  <circle cx="620" cy="140" r="70" fill="#FFE082"/>
  ${mainScene}
</svg>`;
  fs.writeFileSync(filepath, svg, 'utf8');
  return { url: `/storage/images/${filename}`, path: filepath, mock: true, cached: false };
}

function lookupCache(hash, { allowMock = true } = {}) {
  const index = readIndex();
  const entry = index[hash];
  if (!entry?.filename) return null;
  const filepath = path.join(imagesDir(), entry.filename);
  if (!fs.existsSync(filepath)) return null;
  if (!allowMock && entry.mock) return null;
  return {
    url: `/storage/images/${entry.filename}`,
    path: filepath,
    mock: Boolean(entry.mock),
    cached: true,
    hash,
    model: entry.model || null,
  };
}

function saveCacheEntry(hash, filename, meta = {}) {
  const index = readIndex();
  index[hash] = {
    filename,
    createdAt: new Date().toISOString(),
    ...meta,
  };
  writeIndex(index);
}

function illustrationCacheScope() {
  const scope = String(config.illustrationCacheScope || 'scene').toLowerCase();
  if (['story', 'exact', 'false', 'off', 'none'].includes(scope)) return 'story';
  if (scope === 'topic') return 'topic';
  return 'scene';
}

function cacheMeta({ title, theme, phase, hash, reuseHash, extra = {} }) {
  const scope = illustrationCacheScope();
  return {
    title,
    theme,
    phase,
    exactHash: hash,
    reuseHash,
    cacheScope: scope,
    ...extra,
  };
}

function saveIllustrationCacheEntries({
  hash,
  reuseHash,
  filename,
  title,
  theme,
  phase,
  meta = {},
}) {
  const base = cacheMeta({ title, theme, phase, hash, reuseHash, extra: meta });
  saveCacheEntry(hash, filename, base);
  const scope = illustrationCacheScope();
  if (scope !== 'story' && reuseHash) {
    saveCacheEntry(reuseHash, filename, {
      ...base,
      aliasFor: hash,
      cacheScope: scope,
    });
  }
}

async function downloadToFile(remoteUrl, filepath) {
  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`Image download failed (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filepath, buf);
  return buf.length;
}

function modelChain() {
  const preferred = (config.illustrationModel || '').trim();
  if (preferred) {
    return [preferred, ...DEFAULT_MODEL_CHAIN.filter((m) => m !== preferred)];
  }
  return [...DEFAULT_MODEL_CHAIN];
}

function sizeForModel(model) {
  const envSize = config.illustrationSize;
  if (envSize) return envSize;
  if (/^dall-e-2$/i.test(model)) return '512x512';
  // GPT Image models support standard square output; quality/compression keep files light.
  return '1024x1024';
}

function formatForModel(model) {
  if (!/^gpt-image/i.test(model)) return 'png';
  const requested = String(config.illustrationFormat || 'webp').toLowerCase();
  return ['webp', 'jpeg', 'png'].includes(requested) ? requested : 'webp';
}

async function generateWithModel(client, model, prompt) {
  const size = sizeForModel(model);
  const isGptImage = /^gpt-image/i.test(model);
  const quality = config.illustrationQuality || 'low';

  const params = {
    model,
    prompt,
    n: 1,
    size,
  };
  if (isGptImage) {
    // low = lightest / cheapest kids-friendly option on gpt-image-1
    params.quality = ['low', 'medium', 'high', 'auto'].includes(quality) ? quality : 'low';
    params.output_format = formatForModel(model);
    if (['webp', 'jpeg'].includes(params.output_format)) {
      params.output_compression = Math.max(
        0,
        Math.min(100, Number(config.illustrationCompression) || 70),
      );
    }
  } else if (/^dall-e-3$/i.test(model)) {
    params.quality = quality === 'high' ? 'hd' : 'standard';
  }

  const result = await client.images.generate(params);
  const remoteUrl = result.data?.[0]?.url;
  const b64 = result.data?.[0]?.b64_json;
  if (!remoteUrl && !b64) {
    throw new Error(`${model} returned no image data`);
  }
  return { remoteUrl, b64, model, size, format: params.output_format || 'png' };
}

/**
 * Generate (or reuse cached) kids-friendly illustration for a story.
 * Uses OpenAI image models and caches by scene hash.
 */
export async function generateIllustration({
  title,
  theme,
  text,
  phase = 2,
  force = false,
} = {}) {
  const hash = illustrationCacheKey({ title, theme, text, phase });
  const scope = illustrationCacheScope();
  const reuseHash =
    scope === 'topic'
      ? illustrationSceneCacheKey({ title: '', theme, text: '', phase })
      : illustrationSceneCacheKey({ title, theme, text, phase });
  const client = config.illustrationsEnabled ? getImageClient() : null;

  if (!force) {
    // Prefer real cached art; skip SVG placeholders when an API key is available
    const hit = lookupCache(hash, { allowMock: !client });
    if (hit) {
      console.log('Illustration exact cache hit:', hash.slice(0, 12), hit.mock ? '(placeholder)' : '');
      return { ...hit, reuse: 'exact' };
    }
    if (scope !== 'story') {
      const reuseHit = lookupCache(reuseHash, { allowMock: !client });
      if (reuseHit) {
        console.log(
          `Illustration ${scope} cache hit:`,
          reuseHash.slice(0, 12),
          `theme=${theme || 'adventure'}`,
          reuseHit.mock ? '(placeholder)' : '',
        );
        saveCacheEntry(hash, path.basename(reuseHit.path), {
          ...cacheMeta({
            title,
            theme,
            phase,
            hash,
            reuseHash,
            extra: {
              mock: reuseHit.mock,
              aliasFor: reuseHash,
              recovered: false,
              reuse: scope,
            },
          }),
        });
        return {
          ...reuseHit,
          cached: true,
          hash,
          reuseHash,
          reuse: scope,
        };
      }
    }
    for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
      const filepath = path.join(imagesDir(), `${hash}${ext}`);
      if (fs.existsSync(filepath)) {
        const filename = `${hash}${ext}`;
        saveIllustrationCacheEntries({
          hash,
          reuseHash,
          filename,
          title,
          theme,
          phase,
          meta: { mock: false, recovered: true },
        });
        return {
          url: `/storage/images/${filename}`,
          path: filepath,
          mock: false,
          cached: true,
          hash,
          reuseHash,
          reuse: 'exact-file',
        };
      }
    }
  }

  if (!client) {
    const placeholder = writeSvgPlaceholder({ title, theme, text, phase, hash });
    saveIllustrationCacheEntries({
      hash,
      reuseHash,
      filename: path.basename(placeholder.path),
      title,
      theme,
      phase,
      meta: {
        mock: true,
        reason: 'no_api_key',
      },
    });
    return { ...placeholder, hash, reuseHash, reuse: 'placeholder' };
  }

  const prompt = buildKidsPrompt({ title, theme, text, phase });
  const errors = [];

  for (const model of modelChain()) {
    try {
      const { remoteUrl, b64, size, format } = await generateWithModel(client, model, prompt);
      const ext = ['webp', 'jpeg', 'jpg', 'png'].includes(format) ? format.replace('jpeg', 'jpg') : 'png';
      const filename = `${hash}.${ext}`;
      const filepath = path.join(imagesDir(), filename);

      if (b64) {
        fs.writeFileSync(filepath, Buffer.from(b64, 'base64'));
      } else {
        await downloadToFile(remoteUrl, filepath);
      }

      const bytes = fs.statSync(filepath).size;
      saveIllustrationCacheEntries({
        hash,
        reuseHash,
        filename,
        title,
        theme,
        phase,
        meta: {
          mock: false,
          model,
          size,
          format,
          quality: config.illustrationQuality || 'low',
          compression: /^gpt-image/i.test(model) ? config.illustrationCompression : null,
          bytes,
          prompt: prompt.slice(0, 280),
        },
      });

      console.log(
        'Illustration generated & cached:',
        hash.slice(0, 12),
        model,
        `${Math.round(bytes / 1024)}KB`,
      );
      return {
        url: `/storage/images/${filename}`,
        path: filepath,
        mock: false,
        cached: false,
        hash,
        reuseHash,
        reuse: 'generated',
        model,
        bytes,
      };
    } catch (err) {
      errors.push(`${model}: ${err.message}`);
      console.warn(`Illustration ${model} failed:`, err.message);
    }
  }

  console.warn('Illustration all models failed, placeholder used:', errors.join(' | '));
  const placeholder = writeSvgPlaceholder({ title, theme, text, phase, hash });
  saveIllustrationCacheEntries({
    hash,
    reuseHash,
    filename: path.basename(placeholder.path),
    title,
    theme,
    phase,
    meta: {
      mock: true,
      reason: errors.join(' | '),
    },
  });
  return { ...placeholder, hash, reuseHash, reuse: 'placeholder-error' };
}
