import { Router } from 'express';
import {
  listPhases,
  getPhaseGuide,
  highlightText,
  PHONEMES,
  ALL_IPA,
  listAllPhonemes,
  CONSONANT_IPA,
  VOWEL_IPA,
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

/** Full 44-phoneme bank (colours, examples, blend, phase, audio recipe metadata). */
router.get('/phonemes', (_req, res) => {
  res.json({
    all: ALL_IPA,
    count: ALL_IPA.length,
    consonants: CONSONANT_IPA,
    vowels: VOWEL_IPA,
    phonemes: PHONEMES,
    list: listAllPhonemes(),
  });
});

router.post('/highlight', (req, res) => {
  const { text, phase = 2 } = req.body || {};
  res.json({ highlight: highlightText(text || '', Number(phase) || 2) });
});

export default router;
