import { Router } from 'express';
import {
  listPhases,
  getPhaseGuide,
  highlightText,
  PHONEMES,
  ALL_IPA,
} from '../../../shared/phonicsEngine.js';

const router = Router();

router.get('/phases', (_req, res) => {
  res.json(listPhases());
});

router.get('/phases/:phase', (req, res) => {
  const phase = Number(req.params.phase);
  const guide = getPhaseGuide(phase);
  if (!guide) return res.status(404).json({ error: 'unknown phase' });
  res.json(guide);
});

router.get('/phonemes', (_req, res) => {
  res.json({ all: ALL_IPA, phonemes: PHONEMES });
});

router.post('/highlight', (req, res) => {
  const { text, phase = 2 } = req.body || {};
  res.json({ highlight: highlightText(text || '', Number(phase) || 2) });
});

export default router;
