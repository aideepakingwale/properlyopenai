import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { childrenRepo, storiesRepo } from '../db/repositories.js';
import { generateStory, createPracticeStory } from '../services/storyService.js';
import { generateIllustration } from '../services/illustrationService.js';
import { generateStoryPdf } from '../services/pdfService.js';
import { highlightText } from '../../../shared/phonicsEngine.js';
import { getPracticeSentences } from '../../../shared/practiceSentences.js';
import { config } from '../config.js';

const router = Router();

/** List curated practice sentences for a phase (no DB write). */
router.get('/practice', (req, res) => {
  const phase = Number(req.query.phase) || 2;
  const sentences = getPracticeSentences(phase);
  res.json({
    phase,
    title: `Phase ${phase} practice sentences`,
    sentences,
    text: sentences.join(' '),
  });
});

/** Create a practice-sentence pack story for a reading/assessment session. */
router.post('/practice', async (req, res) => {
  try {
    const { childId, phase, theme, count } = req.body || {};
    let child = null;
    if (childId) child = childrenRepo.get(childId);
    const ph = Number(phase) || child?.phase || 2;

    let story = createPracticeStory({
      phase: ph,
      theme: theme || 'practice',
      childId: child?.id || null,
      count: count ? Number(count) : undefined,
    });

    const illustration = await generateIllustration({
      title: story.title,
      theme: story.theme,
      text: story.text,
      phase: ph,
    });
    story = storiesRepo.updatePaths(story.id, { illustrationUrl: illustration.url });

    const pdf = await generateStoryPdf(story);
    story = storiesRepo.updatePaths(story.id, {
      illustrationUrl: illustration.url,
      pdfPath: pdf.url,
    });

    res.status(201).json({
      ...story,
      highlight: highlightText(story.text, story.phase),
      sentences: story.metadata?.sentences || getPracticeSentences(ph),
      kind: 'practice',
      illustrationCached: Boolean(illustration.cached),
      illustrationMock: Boolean(illustration.mock),
      illustrationReuse: illustration.reuse || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'practice pack failed' });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const { childId, phase, theme, interests } = req.body || {};
    let child = null;
    if (childId) child = childrenRepo.get(childId);
    const ph = Number(phase) || child?.phase || 2;
    const ints = interests || child?.interests || [];
    let story = await generateStory({
      phase: ph,
      theme: theme || ints[0] || 'animals',
      interests: ints,
      childId: child?.id || null,
    });

    const illustration = await generateIllustration({
      title: story.title,
      theme: story.theme,
      text: story.text,
      phase: ph,
    });
    const withImage = storiesRepo.updatePaths(story.id, {
      illustrationUrl: illustration.url,
    });

    const pdf = await generateStoryPdf(withImage);
    story = storiesRepo.updatePaths(story.id, {
      illustrationUrl: illustration.url,
      pdfPath: pdf.url,
    });

    res.status(201).json({
      ...story,
      highlight: highlightText(story.text, story.phase),
      illustrationCached: Boolean(illustration.cached),
      illustrationMock: Boolean(illustration.mock),
      illustrationReuse: illustration.reuse || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'story generation failed' });
  }
});

router.get('/:id', (req, res) => {
  const story = storiesRepo.get(req.params.id);
  if (!story) return res.status(404).json({ error: 'not found' });
  res.json({
    ...story,
    highlight: highlightText(story.text, story.phase),
  });
});

router.get('/:id/pdf', (req, res) => {
  const story = storiesRepo.get(req.params.id);
  if (!story) return res.status(404).json({ error: 'not found' });
  if (!story.pdfPath) return res.status(404).json({ error: 'pdf not ready' });
  const local = path.join(config.storageDir, story.pdfPath.replace(/^\/storage\//, ''));
  if (!fs.existsSync(local)) return res.status(404).json({ error: 'pdf missing' });
  res.download(local, `${story.title || 'story'}.pdf`);
});

export default router;
