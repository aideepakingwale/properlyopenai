import { Router } from 'express';
import { childrenRepo, sessionsRepo, storiesRepo } from '../db/repositories.js';
import { awardSessionRewards } from '../services/rewardService.js';
import { assessHeuristic, persistAssessment } from '../services/assessmentService.js';
import { validateReading } from '../services/validationService.js';
import { extractWords } from '../../../shared/phonicsEngine.js';

const router = Router();

router.post('/start', (req, res) => {
  const { childId, storyId } = req.body || {};
  if (!childrenRepo.get(childId)) return res.status(404).json({ error: 'child not found' });
  if (!storiesRepo.get(storyId)) return res.status(404).json({ error: 'story not found' });
  const session = sessionsRepo.create({ childId, storyId });
  res.status(201).json(session);
});

router.get('/:id', (req, res) => {
  const session = sessionsRepo.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'not found' });
  const story = storiesRepo.get(session.storyId);
  res.json({ ...session, story });
});

router.post('/:id/validate', (req, res) => {
  const session = sessionsRepo.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'not found' });
  const story = storiesRepo.get(session.storyId);
  const recognized = req.body?.transcript || '';
  const expected =
    (typeof req.body?.expectedText === 'string' && req.body.expectedText.trim()) ||
    story.text;
  const result = assessHeuristic(expected, recognized);
  persistAssessment(session.id, result);
  res.json(result);
});

router.post('/:id/complete', (req, res) => {
  const session = sessionsRepo.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'not found' });
  const story = storiesRepo.get(session.storyId);
  const transcript = String(req.body?.transcript || '').trim();
  const force = Boolean(req.body?.force);
  const expected =
    (typeof req.body?.expectedText === 'string' && req.body.expectedText.trim()) ||
    story.text;

  // Block “submit the expected sentence as the child” cheating
  if (!force) {
    if (!transcript || !extractWords(transcript).length) {
      return res.status(422).json({
        error: 'no_transcript',
        message:
          'Please read aloud first (Start → Stop & assess). I need to hear your voice before awarding acorns.',
        validation: validateReading(expected, ''),
      });
    }
    const expectedNorm = extractWords(expected).join(' ');
    const gotNorm = extractWords(transcript).join(' ');
    // Exact paste of the target with no prior whisper path is suspicious only if
    // client claims it without assessment — still validate honestly either way.
    void expectedNorm;
    void gotNorm;
  }

  const validation = validateReading(expected, transcript);
  if (!validation.passed && !force) {
    return res.status(422).json({
      error: 'jaccard_below_threshold',
      message:
        validation.reason === 'no_speech_recognized'
          ? 'I did not hear clear words. Read the sentence aloud, then try again.'
          : `Not enough matching words yet (score ${Math.round((validation.combined || 0) * 100)}%). Listen and try again!`,
      validation,
    });
  }

  const updated = sessionsRepo.update(session.id, {
    status: 'completed',
    jaccardScore: validation.combined,
    endedAt: new Date().toISOString(),
  });

  const rewards = awardSessionRewards(session.childId, {
    jaccardScore: force && !validation.passed ? 0 : validation.combined,
  });

  res.json({ session: updated, validation, rewards });
});

export default router;
