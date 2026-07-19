import { Router } from 'express';
import { childrenRepo, rewardsRepo, sessionsRepo, storiesRepo } from '../db/repositories.js';

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
  const sessionsWithStories = sessions.map((session) => ({
    ...session,
    story: storiesRepo.get(session.storyId),
  }));
  const rewards = rewardsRepo.listForChild(child.id);
  const completed = sessions.filter((s) => s.status === 'completed');
  const stats = buildProgressStats(child, completed);
  res.json({
    child,
    sessions: sessionsWithStories,
    rewards,
    stats,
    gamification: buildGamification(child, completed, rewards, stats),
  });
});

router.get('/:id/rewards', (req, res) => {
  const child = childrenRepo.get(req.params.id);
  if (!child) return res.status(404).json({ error: 'not found' });
  res.json(rewardsRepo.listForChild(child.id));
});

export default router;

function buildProgressStats(child, completed) {
  const today = new Date().toISOString().slice(0, 10);
  const sessionsToday = completed.filter((s) => String(s.endedAt || s.startedAt).slice(0, 10) === today).length;
  const averageJaccard =
    completed.length === 0
      ? 0
      : completed.reduce((a, s) => a + (s.jaccardScore || 0), 0) / completed.length;
  const bestScore = completed.reduce((best, s) => Math.max(best, s.jaccardScore || 0), 0);

  return {
    completedSessions: completed.length,
    sessionsToday,
    averageJaccard,
    bestScore,
    phase: child.phase,
  };
}

function buildGamification(child, completed, rewards, stats) {
  const acorns = Number(child.acorns) || 0;
  const level = Math.floor(acorns / 25) + 1;
  const currentLevelStart = (level - 1) * 25;
  const nextLevelAt = level * 25;
  const rewardTypes = new Set(rewards.map((r) => r.type));

  return {
    level: {
      name: levelName(level),
      level,
      acorns,
      currentLevelStart,
      nextLevelAt,
      progress: nextLevelAt === currentLevelStart ? 1 : (acorns - currentLevelStart) / (nextLevelAt - currentLevelStart),
    },
    dailyQuest: {
      title: 'Read one story today',
      current: Math.min(1, stats.sessionsToday),
      target: 1,
      complete: stats.sessionsToday >= 1,
      reward: '+10 to +15 acorns',
    },
    phaseQuest: {
      title: `Phase ${child.phase} path`,
      current: Math.min(5, completed.filter((s) => (storiesRepo.get(s.storyId)?.phase || child.phase) === child.phase).length),
      target: 5,
      complete: completed.filter((s) => (storiesRepo.get(s.storyId)?.phase || child.phase) === child.phase).length >= 5,
      reward: 'Phase Star',
    },
    badges: badgeDefinitions(stats, child, rewardTypes),
  };
}

function badgeDefinitions(stats, child, rewardTypes) {
  return [
    {
      type: 'trophy_first_story',
      icon: 'star',
      label: 'First Story',
      hint: 'Finish your first read aloud.',
      earned: rewardTypes.has('trophy_first_story') || stats.completedSessions >= 1,
      progress: Math.min(1, stats.completedSessions / 1),
    },
    {
      type: 'trophy_five_stories',
      icon: 'trail',
      label: 'Story Trail',
      hint: 'Read 5 stories.',
      earned: rewardTypes.has('trophy_five_stories') || stats.completedSessions >= 5,
      progress: Math.min(1, stats.completedSessions / 5),
    },
    {
      type: 'trophy_clear_reader',
      icon: 'voice',
      label: 'Clear Reader',
      hint: 'Score 90% on a read aloud.',
      earned: rewardTypes.has('trophy_clear_reader') || stats.bestScore >= 0.9,
      progress: Math.min(1, stats.bestScore / 0.9),
    },
    {
      type: 'trophy_phase_star',
      icon: 'phase',
      label: 'Phase Star',
      hint: 'Score 80% or more.',
      earned: rewardTypes.has('trophy_phase_star') || stats.bestScore >= 0.8,
      progress: Math.min(1, stats.bestScore / 0.8),
    },
    {
      type: 'trophy_acorn_collector',
      icon: 'acorn',
      label: 'Acorn Collector',
      hint: 'Collect 50 acorns.',
      earned: rewardTypes.has('trophy_acorn_collector') || child.acorns >= 50,
      progress: Math.min(1, (child.acorns || 0) / 50),
    },
  ];
}

function levelName(level) {
  if (level >= 8) return 'Oak Legend';
  if (level >= 5) return 'Branch Builder';
  if (level >= 3) return 'Sapling Reader';
  return 'Acorn Starter';
}
