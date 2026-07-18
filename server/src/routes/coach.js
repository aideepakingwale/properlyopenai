import { Router } from 'express';
import { childrenRepo } from '../db/repositories.js';
import { coachMessage } from '../services/storyService.js';
import { synthesizeSpeech } from '../services/ttsService.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { childId, context, issue, speak = true, targetSentence } = req.body || {};
    const child = childId ? childrenRepo.get(childId) : null;
    const coach = await coachMessage({
      childName: child?.name,
      phase: child?.phase || 2,
      context,
      issue,
      targetSentence,
    });
    let audio = null;
    if (speak) {
      audio = await synthesizeSpeech(coach.message);
    }
    res.json({ ...coach, audio });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'coach failed' });
  }
});

export default router;
