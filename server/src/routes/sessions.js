import { Router } from 'express';
import { childrenRepo, sessionsRepo, storiesRepo } from '../db/repositories.js';
import { awardSessionRewards } from '../services/rewardService.js';
import { assessHeuristic, persistAssessment } from '../services/assessmentService.js';
import { validateReading } from '../services/validationService.js';

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
  const result = assessHeuristic(story.text, recognized);
  persistAssessment(session.id, result);
  res.json(result);
});

router.post('/:id/complete', (req, res) => {
  const session = sessionsRepo.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'not found' });
  const story = storiesRepo.get(session.storyId);
  const transcript = req.body?.transcript || '';
  const force = Boolean(req.body?.force);

  const validation = validateReading(story.text, transcript);
  if (!validation.passed && !force) {
    return res.status(422).json({
      error: 'jaccard_below_threshold',
      message: 'That did not quite match the story. Try reading it again!',
      validation,
    });
  }

  const updated = sessionsRepo.update(session.id, {
    status: 'completed',
    jaccardScore: validation.combined,
    endedAt: new Date().toISOString(),
  });

  const rewards = awardSessionRewards(session.childId, {
    jaccardScore: validation.combined,
  });

  res.json({ session: updated, validation, rewards });
});

export default router;
