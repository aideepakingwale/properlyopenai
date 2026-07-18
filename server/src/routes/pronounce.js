import { Router } from 'express';
import { createPronunciationGuide } from '../services/pronounceService.js';

const router = Router();

/**
 * POST /api/pronounce
 * body: { type, value?, text?, ipa?, grapheme?, phase?, speak?, hearMode?: 'phonemes'|'words'|'full' }
 */
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const type = body.type || 'word';
    if (!['phoneme', 'word', 'sentence', 'story'].includes(type)) {
      return res.status(400).json({ error: 'type must be phoneme, word, sentence, or story' });
    }
    if (type === 'phoneme' && !body.ipa && !body.grapheme && !body.value) {
      return res.status(400).json({ error: 'phoneme requires ipa or grapheme' });
    }
    if (type === 'word' && !body.value && !body.text) {
      return res.status(400).json({ error: 'word requires value' });
    }
    if ((type === 'sentence' || type === 'story') && !body.text && !body.value) {
      return res.status(400).json({ error: 'sentence/story requires text' });
    }

    const hearMode = body.hearMode || 'phonemes';
    // Only synthesize unbroken full-page TTS when explicitly requested
    const wantSpeak = body.speak === true || hearMode === 'full';
    const guide = await createPronunciationGuide(
      {
        type,
        value: body.value,
        text: body.text || body.value,
        ipa: body.ipa,
        grapheme: body.grapheme,
        phase: body.phase,
        hearMode,
      },
      { speak: wantSpeak },
    );
    res.json(guide);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'pronounce failed' });
  }
});

export default router;
