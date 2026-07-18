import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { config } from '../config.js';

/** Bump when prompt / model defaults change so old SVG placeholders are not reused. */
const CACHE_VERSION = 'v4';
const INDEX_NAME = 'cache-index.json';

/**
 * Image models are NOT in Cursor/OpenAI free daily chat limits — they bill at standard rates.
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
  return [
    'Cheerful UK early-reader picture-book spot illustration for children aged 4 to 7.',
    'Style: bright playful classroom storybook art, soft flat colours, simple friendly shapes, expressive characters, light and airy, uncluttered.',
    'Composition: one clear subject, large readable shapes, colourful background details, suitable as a small story thumbnail.',
    'NOT photorealistic, NOT dark, NOT scary, NOT violent, NOT 3D CGI, NOT adult themes, NOT a generic landscape.',
    'No text, letters, numbers, captions, logos, or watermarks anywhere in the image.',
    'Make the picture directly match the story theme and the chosen child interest.',
    `Letters and Sounds Phase ${Number(phase) || 2} storybook mood.`,
    `Story title (do not write it in the image): ${title || 'My Story'}.`,
    `Chosen child topic/theme: ${theme || 'adventure'}.`,
    `Scene to depict: ${scene}`,
  ].join(' ');
}

function writeSvgPlaceholder({ title, theme, phase, hash }) {
  const dir = imagesDir();
  const filename = `${hash || crypto.randomUUID()}.svg`;
  const filepath = path.join(dir, filename);
  if (fs.existsSync(filepath)) {
    return { url: `/storage/images/${filename}`, path: filepath, mock: true, cached: true };
  }

  const safeTitle = String(title || 'Story').replace(/[<>&]/g, '').slice(0, 40);
  const safeTheme = String(theme || 'adventure').replace(/[<>&]/g, '').slice(0, 28);
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
  <ellipse cx="384" cy="560" rx="260" ry="70" fill="#81C784" opacity="0.85"/>
  <circle cx="280" cy="420" r="48" fill="#FFF8E1" stroke="#8D6E63" stroke-width="4"/>
  <ellipse cx="280" cy="400" rx="22" ry="28" fill="#8D6E63"/>
  <circle cx="268" cy="416" r="4" fill="#1B4332"/>
  <circle cx="292" cy="416" r="4" fill="#1B4332"/>
  <text x="384" y="660" text-anchor="middle" font-family="Georgia, serif" font-size="36" fill="#1B4332">${safeTitle}</text>
  <text x="384" y="705" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="#3D405B">Phase ${Number(phase) || 2} · ${safeTheme}</text>
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
 * Uses OpenAI image models (gpt-image-1 / DALL·E) and caches by scene hash.
 */
export async function generateIllustration({
  title,
  theme,
  text,
  phase = 2,
  force = false,
} = {}) {
  const hash = illustrationCacheKey({ title, theme, text, phase });
  const client = config.illustrationsEnabled ? getImageClient() : null;

  if (!force) {
    // Prefer real cached art; skip SVG placeholders when an API key is available
    const hit = lookupCache(hash, { allowMock: !client });
    if (hit) {
      console.log('Illustration cache hit:', hash.slice(0, 12), hit.mock ? '(placeholder)' : '');
      return hit;
    }
    for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
      const filepath = path.join(imagesDir(), `${hash}${ext}`);
      if (fs.existsSync(filepath)) {
        const filename = `${hash}${ext}`;
        saveCacheEntry(hash, filename, { title, theme, phase, mock: false, recovered: true });
        return {
          url: `/storage/images/${filename}`,
          path: filepath,
          mock: false,
          cached: true,
          hash,
        };
      }
    }
  }

  if (!client) {
    const placeholder = writeSvgPlaceholder({ title, theme, phase, hash });
    saveCacheEntry(hash, path.basename(placeholder.path), {
      title,
      theme,
      phase,
      mock: true,
      reason: 'no_api_key',
    });
    return { ...placeholder, hash };
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
      saveCacheEntry(hash, filename, {
        title,
        theme,
        phase,
        mock: false,
        model,
        size,
        format,
        quality: config.illustrationQuality || 'low',
        compression: /^gpt-image/i.test(model) ? config.illustrationCompression : null,
        bytes,
        prompt: prompt.slice(0, 280),
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
        model,
        bytes,
      };
    } catch (err) {
      errors.push(`${model}: ${err.message}`);
      console.warn(`Illustration ${model} failed:`, err.message);
    }
  }

  console.warn('Illustration all models failed, placeholder used:', errors.join(' | '));
  const placeholder = writeSvgPlaceholder({ title, theme, phase, hash });
  saveCacheEntry(hash, path.basename(placeholder.path), {
    title,
    theme,
    phase,
    mock: true,
    reason: errors.join(' | '),
  });
  return { ...placeholder, hash };
}
