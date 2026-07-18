import { Router } from 'express';
import { childrenRepo, rewardsRepo, sessionsRepo } from '../db/repositories.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json(childrenRepo.list());
});

router.post('/', (req, res) => {
  const { name, interests, phase } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const child = childrenRepo.create({
    name: String(name).trim(),
    interests: Array.isArray(interests) ? interests : String(interests || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    phase: Number(phase) || 2,
  });
  res.status(201).json(child);
});

router.get('/:id', (req, res) => {
  const child = childrenRepo.get(req.params.id);
  if (!child) return res.status(404).json({ error: 'not found' });
  res.json(child);
});

router.patch('/:id', (req, res) => {
  const child = childrenRepo.update(req.params.id, req.body || {});
  if (!child) return res.status(404).json({ error: 'not found' });
  res.json(child);
});

router.get('/:id/progress', (req, res) => {
  const child = childrenRepo.get(req.params.id);
  if (!child) return res.status(404).json({ error: 'not found' });
  const sessions = sessionsRepo.listForChild(child.id);
  const rewards = rewardsRepo.listForChild(child.id);
  const completed = sessions.filter((s) => s.status === 'completed');
  res.json({
    child,
    sessions,
    rewards,
    stats: {
      completedSessions: completed.length,
      averageJaccard:
        completed.length === 0
          ? 0
          : completed.reduce((a, s) => a + (s.jaccardScore || 0), 0) / completed.length,
      phase: child.phase,
    },
  });
});

router.get('/:id/rewards', (req, res) => {
  const child = childrenRepo.get(req.params.id);
  if (!child) return res.status(404).json({ error: 'not found' });
  res.json(rewardsRepo.listForChild(child.id));
});

export default router;
