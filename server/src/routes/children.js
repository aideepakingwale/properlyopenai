import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import sharp from 'sharp';
import { config } from '../config.js';
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

router.post('/:id/avatar', async (req, res, next) => {
  try {
    const child = childrenRepo.get(req.params.id);
    if (!child) return res.status(404).json({ error: 'not found' });

    const { image } = req.body || {};
    const parsed = parseAvatarImage(image);
    if (!parsed) {
      return res.status(400).json({ error: 'A PNG, JPEG, or WebP data URL is required.' });
    }

    const avatarDir = path.join(config.storageDir, 'avatars');
    fs.mkdirSync(avatarDir, { recursive: true });
    const fileName = `${child.id}-${Date.now()}.webp`;
    const filePath = path.join(avatarDir, fileName);

    await sharp(parsed.buffer)
      .rotate()
      .resize(256, 256, { fit: 'cover', position: 'attention' })
      .webp({ quality: 76, effort: 4 })
      .toFile(filePath);

    const avatarUrl = `/storage/avatars/${fileName}`;
    const updated = childrenRepo.update(child.id, { avatarUrl });
    res.json(updated);
  } catch (err) {
    next(err);
  }
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

function parseAvatarImage(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 2_500_000) return null;
  return { mime: match[1], buffer };
}

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
  const phaseSessions = completed.filter((s) => (storiesRepo.get(s.storyId)?.phase || child.phase) === child.phase).length;
  const journey = buildJourney(child, stats, acorns, phaseSessions, rewardTypes);

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
      current: Math.min(5, phaseSessions),
      target: 5,
      complete: phaseSessions >= 5,
      reward: 'Phase Star',
    },
    currentMission: buildCurrentMission(stats, child, acorns, phaseSessions),
    journey,
    badges: badgeDefinitions(stats, child, rewardTypes),
  };
}

function buildCurrentMission(stats, child, acorns, phaseSessions) {
  return {
    title: 'Current Mission',
    subtitle: 'Complete small practice steps to open the next reward chest.',
    reward: nextRewardName(stats, child, acorns),
    tasks: [
      {
        id: 'hear_sounds',
        label: 'Hear 3 sounds',
        current: Math.min(3, stats.sessionsToday > 0 ? 3 : stats.completedSessions % 3),
        target: 3,
        complete: stats.sessionsToday > 0,
      },
      {
        id: 'read_words',
        label: 'Read 2 words',
        current: Math.min(2, stats.completedSessions > 0 ? 2 : phaseSessions),
        target: 2,
        complete: stats.completedSessions > 0,
      },
      {
        id: 'read_sentence',
        label: 'Read 1 sentence',
        current: Math.min(1, stats.sessionsToday),
        target: 1,
        complete: stats.sessionsToday >= 1,
      },
    ],
  };
}

function nextRewardName(stats, child, acorns) {
  if (stats.completedSessions < 1) return 'Sound Explorer Badge';
  if (stats.completedSessions < 3) return 'Blend Bridge Chest';
  if ((stats.bestScore || 0) < 0.8) return 'Clear Voice Star';
  if (acorns < 50) return 'Acorn Collector Badge';
  if ((child.streak || 0) < 7) return 'Seven Day Flame';
  return 'Treasure Library Key';
}

function buildJourney(child, stats, acorns, phaseSessions, rewardTypes) {
  const stages = [
    {
      id: 'sound_forest',
      order: 1,
      title: 'Sound Forest',
      reward: 'Sound Explorer Badge',
      icon: 'ear',
      theme: 'forest',
      metric: 'stories',
      current: stats.completedSessions,
      target: 1,
      summary: 'Hear, tap, and copy first phonics sounds.',
      goal: 'Finish your first read aloud.',
      trophy: 'trophy_first_story',
    },
    {
      id: 'blend_bridge',
      order: 2,
      title: 'Blend Bridge',
      reward: 'Blend Builder Chest',
      icon: 'bridge',
      theme: 'bridge',
      metric: 'stories',
      current: stats.completedSessions,
      target: 3,
      summary: 'Blend sounds into short words.',
      goal: 'Complete 3 story missions.',
      trophy: 'trophy_super_listener',
    },
    {
      id: 'word_meadow',
      order: 3,
      title: 'Word Meadow',
      reward: 'Word Gardener Badge',
      icon: 'word',
      theme: 'meadow',
      metric: 'phase',
      current: phaseSessions,
      target: 5,
      summary: 'Read phase-safe words with confidence.',
      goal: `Finish 5 Phase ${child.phase} reads.`,
      trophy: 'trophy_five_stories',
    },
    {
      id: 'sentence_stream',
      order: 4,
      title: 'Sentence Stream',
      reward: 'Clear Voice Star',
      icon: 'voice',
      theme: 'stream',
      metric: 'score',
      current: Math.round((stats.bestScore || 0) * 100),
      target: 80,
      suffix: '%',
      summary: 'Read full sentences aloud clearly.',
      goal: 'Score 80% or more once.',
      trophy: 'trophy_phase_star',
    },
    {
      id: 'story_mountain',
      order: 5,
      title: 'Story Mountain',
      reward: 'Story Champion Flag',
      icon: 'mountain',
      theme: 'mountain',
      metric: 'score',
      current: Math.round((stats.bestScore || 0) * 100),
      target: 90,
      suffix: '%',
      summary: 'Climb into fluent full-story reading.',
      goal: 'Score 90% on read aloud.',
      trophy: 'trophy_clear_reader',
    },
    {
      id: 'treasure_library',
      order: 6,
      title: 'Treasure Library',
      reward: 'Library Key',
      icon: 'library',
      theme: 'library',
      metric: 'acorns',
      current: acorns,
      target: 100,
      summary: 'Build a habit and unlock the reward vault.',
      goal: 'Collect 100 acorns.',
      trophy: 'trophy_oak_guardian',
    },
  ];

  const enriched = stages.map((stage) => {
    const progress = Math.min(1, (Number(stage.current) || 0) / stage.target);
    const complete = progress >= 1 || rewardTypes.has(stage.trophy);
    return {
      ...stage,
      current: Math.min(stage.target, Number(stage.current) || 0),
      progress,
      complete,
      locked: false,
    };
  });
  const currentIndex = enriched.findIndex((stage) => !stage.complete);
  const activeIndex = currentIndex === -1 ? enriched.length - 1 : Math.max(0, currentIndex);

  return {
    title: "Mrs Owl's Phonics Quest",
    activeStageId: enriched[activeIndex]?.id,
    activeStage: enriched[activeIndex],
    stages: enriched.map((stage, index) => ({
      ...stage,
      status: stage.complete ? 'complete' : index === activeIndex ? 'current' : 'locked',
      locked: index > activeIndex,
    })),
    overallProgress: enriched.length
      ? enriched.reduce((sum, stage) => sum + Math.min(1, stage.progress), 0) / enriched.length
      : 0,
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
