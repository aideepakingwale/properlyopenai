import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { v4 as uuid } from 'uuid';
import { highlightText } from '../../../shared/phonicsEngine.js';
import { config } from '../config.js';

const PAGE = {
  width: 595.28,
  height: 841.89,
  margin: 36,
};

const TILE = {
  minWidth: 18,
  height: 19,
  gap: 2,
  wordGap: 5,
};

const PDF_VERSION = 'v7-deepak-website';
const COPYRIGHT_OWNER = 'Deepak Ingwale';
const COPYRIGHT_WEBSITE = 'https://www.deepakingwale.com';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OWL_WATERMARK = path.resolve(__dirname, '../../../client/public/images/mrs-owl-realistic.png');

/**
 * Generate an A4 storybook PDF with the story picture, readable text, and
 * accurate grapheme-to-IPA tiles from the shared phonics engine.
 */
export async function generateStoryPdf(story) {
  const dir = path.join(config.storageDir, 'pdfs');
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${story.id || uuid()}.pdf`;
  const filepath = path.join(dir, filename);
  const metaPath = `${filepath}.json`;
  const imagePath = await resolvePdfImage(story.illustrationUrl);
  const watermarkPath = await resolvePdfAssetImage(OWL_WATERMARK, 'mrs-owl-watermark', 180, 52);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin, autoFirstPage: true });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);
    registerFonts(doc);
    drawWatermark(doc, watermarkPath);
    doc.on('pageAdded', () => drawWatermark(doc, watermarkPath));

    drawHeader(doc, story, imagePath);
    drawStoryText(doc, story);
    drawPhonicsCards(doc, story);
    drawFooter(doc);

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        cacheKey: storyPdfCacheKey(story),
        generatedAt: new Date().toISOString(),
        version: PDF_VERSION,
      },
      null,
      2,
    ),
  );

  return {
    path: filepath,
    url: `/storage/pdfs/${filename}`,
  };
}

export function storyPdfCacheKey(story) {
  return [
    PDF_VERSION,
    story?.id || '',
    story?.title || '',
    story?.text || '',
    story?.phase || '',
    story?.theme || '',
    story?.illustrationUrl || '',
  ].join('|');
}

export function isStoryPdfFresh(story, filepath) {
  if (!filepath || !fs.existsSync(filepath)) return false;
  const metaPath = `${filepath}.json`;
  if (!fs.existsSync(metaPath)) return false;
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    return meta.cacheKey === storyPdfCacheKey(story);
  } catch {
    return false;
  }
}

function registerFonts(doc) {
  const regular = firstExisting([
    path.join(os.homedir(), 'AppData/Local/Microsoft/Windows/Fonts/arial.ttf'),
    'C:/Windows/Fonts/arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  ]);
  const bold = firstExisting([
    path.join(os.homedir(), 'AppData/Local/Microsoft/Windows/Fonts/arialbd.ttf'),
    'C:/Windows/Fonts/arialbd.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  ]);

  if (regular) doc.registerFont('ProperlyRegular', regular);
  if (bold) doc.registerFont('ProperlyBold', bold);
}

function font(doc, weight = 'regular') {
  const name = weight === 'bold' ? 'ProperlyBold' : 'ProperlyRegular';
  try {
    doc.font(name);
  } catch {
    doc.font(weight === 'bold' ? 'Helvetica-Bold' : 'Helvetica');
  }
  return doc;
}

function firstExisting(paths) {
  return paths.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

async function resolvePdfImage(illustrationUrl) {
  if (!illustrationUrl || !illustrationUrl.startsWith('/storage/')) return null;
  const local = path.join(config.storageDir, illustrationUrl.replace(/^\/storage\//, ''));
  if (!fs.existsSync(local)) return null;

  const ext = path.extname(local).toLowerCase();
  if (['.png', '.jpg', '.jpeg'].includes(ext)) return local;

  return resolvePdfAssetImage(local, path.basename(local, ext), 320, 62);
}

async function resolvePdfAssetImage(local, name, size, quality) {
  if (!local || !fs.existsSync(local)) return null;
  const ext = path.extname(local).toLowerCase();
  if (['.jpg', '.jpeg'].includes(ext)) return local;

  const convertedDir = path.join(config.storageDir, 'pdf-images');
  fs.mkdirSync(convertedDir, { recursive: true });
  const converted = path.join(convertedDir, `${name}.jpg`);
  const sourceMtime = fs.statSync(local).mtimeMs;
  const convertedFresh = fs.existsSync(converted) && fs.statSync(converted).mtimeMs >= sourceMtime;
  if (!convertedFresh) {
    await sharp(local)
      .flatten({ background: '#fffdf7' })
      .resize(size, size, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toFile(converted);
  }
  return converted;
}

function drawHeader(doc, story, imagePath) {
  const imageSize = imagePath ? 126 : 0;
  const imageX = PAGE.width - PAGE.margin - imageSize;
  const textWidth = imagePath ? imageX - PAGE.margin - 18 : PAGE.width - PAGE.margin * 2;

  font(doc, 'bold').fontSize(9).fillColor('#8B35DC').text(
    `PHASE ${story.phase || 2} · ${(story.theme || 'story').toUpperCase()}`,
    PAGE.margin,
    PAGE.margin,
    { width: textWidth },
  );

  font(doc, 'bold').fontSize(24).fillColor('#25315A').text(
    story.title || 'My Story',
    PAGE.margin,
    PAGE.margin + 18,
    { width: textWidth, lineGap: 2 },
  );

  font(doc).fontSize(8).fillColor('#6B705C').text(
    'Properly · AI phonics coach · UK Letters and Sounds practice sheet',
    PAGE.margin,
    doc.y + 8,
    { width: textWidth },
  );

  if (imagePath) {
    doc
      .roundedRect(imageX - 6, PAGE.margin - 2, imageSize + 12, imageSize + 16, 14)
      .fillAndStroke('#FFF7D6', '#FFD166');
    doc.image(imagePath, imageX, PAGE.margin + 5, {
      fit: [imageSize, imageSize],
      align: 'center',
      valign: 'center',
    });
    font(doc, 'bold').fontSize(7).fillColor('#8B35DC').text(
      'Story picture',
      imageX,
      PAGE.margin + imageSize + 10,
      { width: imageSize, align: 'center' },
    );
  }

  doc.y = Math.max(doc.y, PAGE.margin + imageSize + 22);
}

function drawStoryText(doc, story) {
  sectionTitle(doc, 'Read the Story');
  const boxY = doc.y;
  const boxHeight = 76;
  doc.roundedRect(PAGE.margin, boxY, contentWidth(), boxHeight, 11).fillAndStroke('#FFFFFF', '#DDEBFF');
  font(doc, 'bold').fontSize(15).fillColor('#25315A').text(story.text || '', PAGE.margin + 12, boxY + 12, {
    width: contentWidth() - 24,
    lineGap: 5,
  });
  doc.y = boxY + boxHeight + 12;
}

function drawPhonicsCards(doc, story) {
  sectionTitle(doc, 'Sound Out the Words');
  font(doc).fontSize(8).fillColor('#6B705C').text(
    'Each coloured tile shows the grapheme on top and the spoken phoneme underneath.',
    PAGE.margin,
    doc.y,
    { width: contentWidth() },
  );
  doc.moveDown(0.45);

  const words = uniqueWords(highlightText(story.text || '', story.phase).filter((p) => p.type === 'word'));
  let x = PAGE.margin;
  let y = doc.y;
  const maxX = PAGE.width - PAGE.margin;

  for (const word of words) {
    const tiles = (word.tiles || []).filter((tile) => tile.grapheme || tile.ipa);
    if (!tiles.length) continue;

    const card = measureWordCard(doc, word.value, tiles);
    if (x + card.width > maxX) {
      x = PAGE.margin;
      y += card.height + 7;
    }
    if (y + card.height > PAGE.height - PAGE.margin - 26) {
      doc.addPage({ margin: PAGE.margin });
      x = PAGE.margin;
      y = PAGE.margin;
    }
    drawWordCard(doc, x, y, word.value, tiles, card);
    x += card.width + TILE.wordGap;
  }

  doc.y = y + 62;
}

function sectionTitle(doc, title) {
  if (doc.y > PAGE.height - PAGE.margin - 105) doc.addPage({ margin: PAGE.margin });
  font(doc, 'bold').fontSize(11).fillColor('#8B35DC').text(title, PAGE.margin, doc.y);
  doc.moveDown(0.25);
}

function measureWordCard(doc, word, tiles) {
  font(doc, 'bold').fontSize(10);
  const labelWidth = Math.max(28, doc.widthOfString(word) + 10);
  const tileWidths = tiles.map((tile) => {
    font(doc, 'bold').fontSize(9);
    const graphemeWidth = doc.widthOfString(tile.grapheme || '') + 7;
    font(doc).fontSize(6);
    const ipaWidth = doc.widthOfString(wrapIpa(tile.ipa)) + 6;
    return Math.max(TILE.minWidth, graphemeWidth, ipaWidth);
  });
  const tilesWidth = tileWidths.reduce((sum, w) => sum + w, 0) + Math.max(0, tileWidths.length - 1) * TILE.gap;
  return {
    width: Math.min(contentWidth(), Math.max(labelWidth, tilesWidth) + 8),
    height: 52,
    tileWidths,
  };
}

function drawWordCard(doc, x, y, word, tiles, card) {
  doc.roundedRect(x, y, card.width, card.height, 8).fillAndStroke('#FFFEF8', '#E7E9F5');
  font(doc, 'bold').fontSize(8).fillColor('#25315A').text(word, x + 4, y + 4, {
    width: card.width - 8,
    align: 'center',
  });

  let tx = x + (card.width - card.tileWidths.reduce((sum, w) => sum + w, 0) - (tiles.length - 1) * TILE.gap) / 2;
  tiles.forEach((tile, index) => {
    const width = card.tileWidths[index];
    doc.roundedRect(tx, y + 19, width, TILE.height, 4).fillAndStroke(tile.color || '#888888', '#FFFFFF');
    font(doc, 'bold').fontSize(9).fillColor('#FFFFFF').text(tile.grapheme || '', tx + 3, y + 24, {
      width: width - 6,
      align: 'center',
      lineBreak: false,
    });
    font(doc).fontSize(6).fillColor('#25315A').text(wrapIpa(tile.ipa), tx, y + 40, {
      width,
      align: 'center',
      lineBreak: false,
    });
    tx += width + TILE.gap;
  });
}

function drawFooter(doc) {
  const footerY = PAGE.height - PAGE.margin - 18;
  font(doc).fontSize(8).fillColor('#6B705C').text(
    `Generated by Properly · (C) ${new Date().getFullYear()} ${COPYRIGHT_OWNER} · ${COPYRIGHT_WEBSITE} · All rights reserved.`,
    PAGE.margin,
    footerY,
    { width: contentWidth(), align: 'center' },
  );
}

function uniqueWords(words) {
  const seen = new Set();
  return words.filter((word) => {
    const key = String(word.value || '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function drawWatermark(doc, watermarkPath) {
  doc.save();
  if (watermarkPath && fs.existsSync(watermarkPath)) {
    doc.opacity(0.12);
    doc.image(watermarkPath, PAGE.width / 2 - 74, PAGE.height / 2 - 104, {
      fit: [148, 148],
      align: 'center',
      valign: 'center',
    });
  }
  doc.opacity(0.085);
  font(doc, 'bold')
    .fontSize(56)
    .fillColor('#25315A')
    .rotate(-28, { origin: [PAGE.width / 2, PAGE.height / 2] })
    .text('Properly', PAGE.margin, PAGE.height / 2 - 12, {
      width: contentWidth(),
      align: 'center',
    });
  doc.opacity(0.1);
  font(doc)
    .fontSize(11)
    .fillColor('#25315A')
    .text(`(C) ${new Date().getFullYear()} ${COPYRIGHT_OWNER} · ${COPYRIGHT_WEBSITE}`, PAGE.margin, PAGE.height / 2 + 42, {
      width: contentWidth(),
      align: 'center',
    });
  doc.restore();
}

function contentWidth() {
  return PAGE.width - PAGE.margin * 2;
}

function wrapIpa(ipa) {
  return ipa ? `/${ipa}/` : '';
}
