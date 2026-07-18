import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { config } from '../config.js';
import { getOpenAI, isMockMode } from './openaiClient.js';

function writeSvgPlaceholder(theme, title) {
  const dir = path.join(config.storageDir, 'images');
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${uuid()}.svg`;
  const filepath = path.join(dir, filename);
  const safeTitle = String(title || 'Story').replace(/[<>&]/g, '');
  const safeTheme = String(theme || 'adventure').replace(/[<>&]/g, '');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7CB342"/>
      <stop offset="55%" stop-color="#FFF8E7"/>
      <stop offset="100%" stop-color="#F4A261"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <circle cx="780" cy="180" r="90" fill="#F6E27A" opacity="0.9"/>
  <ellipse cx="512" cy="720" rx="320" ry="80" fill="#2D6A4F" opacity="0.35"/>
  <text x="512" y="460" text-anchor="middle" font-family="Georgia, serif" font-size="54" fill="#1B4332">${safeTitle}</text>
  <text x="512" y="530" text-anchor="middle" font-family="Georgia, serif" font-size="32" fill="#3D405B">${safeTheme}</text>
  <text x="512" y="900" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#1B4332">Properly · Mrs Owl</text>
</svg>`;
  fs.writeFileSync(filepath, svg, 'utf8');
  return { url: `/storage/images/${filename}`, path: filepath, mock: true };
}

export async function generateIllustration({ title, theme, text }) {
  if (isMockMode()) {
    return writeSvgPlaceholder(theme, title);
  }

  try {
    const openai = getOpenAI();
    const prompt = `Child-friendly storybook illustration, soft watercolor style, UK picture book, no text in image, wholesome: "${title}". Theme: ${theme}. Scene inspired by: ${String(text).slice(0, 200)}`;
    const result = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      size: '1024x1024',
      quality: 'standard',
      n: 1,
    });
    const remoteUrl = result.data[0]?.url;
    if (!remoteUrl) return writeSvgPlaceholder(theme, title);

    const dir = path.join(config.storageDir, 'images');
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${uuid()}.png`;
    const filepath = path.join(dir, filename);
    const res = await fetch(remoteUrl);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filepath, buf);
    return { url: `/storage/images/${filename}`, path: filepath, mock: false };
  } catch (err) {
    console.warn('Illustration failed, placeholder used:', err.message);
    return writeSvgPlaceholder(theme, title);
  }
}
