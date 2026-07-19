import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import sharp from 'sharp';
import { config } from '../config.js';
import { childrenRepo, rewardsRepo, sessionsRepo, storiesRepo } from '../db/repositories.js';

const router = Router();
const AVATAR_MAX_BYTES = 10_000_000;

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

    let output;
    try {
      output = await sharp(parsed.buffer, { limitInputPixels: 36_000_000 })
        .rotate()
        .resize(256, 256, { fit: 'cover', position: 'attention' })
        .webp({ quality: 76, effort: 4 })
        .toBuffer();
    } catch {
      return res.status(400).json({
        error: 'Could not read this picture. Please try a PNG, JPEG, WebP, HEIC, or AVIF photo.',
      });
    }

    fs.writeFileSync(filePath, output);

    const avatarUrl = `/storage/avatars/${fileName}`;
    const previousAvatarUrl = child.avatarUrl;
    const updated = childrenRepo.update(child.id, { avatarUrl });
    removeStoredAvatar(previousAvatarUrl, avatarUrl);
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
  const match = value.match(/^data:([^;,]+)?;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const mime = String(match[1] || '').toLowerCase();
  const allowedMime =
    mime.startsWith('image/') ||
    mime === 'application/octet-stream' ||
    mime === 'binary/octet-stream';
  if (mime && !allowedMime) return null;
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > AVATAR_MAX_BYTES) return null;
  return { mime, buffer };
}

function removeStoredAvatar(previousUrl, nextUrl) {
  if (!previousUrl || previousUrl === nextUrl || !previousUrl.startsWith('/storage/avatars/')) {
    return;
  }
  const avatarDir = path.resolve(config.storageDir, 'avatars');
  const filePath = path.resolve(config.storageDir, previousUrl.replace(/^\/storage\//, ''));
  if (!filePath.startsWith(avatarDir)) return;
  fs.unlink(filePath, () => {});
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
  const levelNumber = Math.floor(acorns / 25) + 1;
  const currentLevelStart = (levelNumber - 1) * 25;
  const nextLevelAt = levelNumber * 25;
  const rewardTypes = new Set(rewards.map((r) => r.type));
  const phaseSessions = completed.filter((s) => (storiesRepo.get(s.storyId)?.phase || child.phase) === child.phase).length;
  const journey = buildJourney(child, stats, acorns, phaseSessions, rewardTypes);
  const levelState = {
    name: levelName(levelNumber),
    level: levelNumber,
    acorns,
    currentLevelStart,
    nextLevelAt,
    progress: nextLevelAt === currentLevelStart ? 1 : (acorns - currentLevelStart) / (nextLevelAt - currentLevelStart),
  };

  return {
    level: levelState,
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
    currentMission: buildCurrentMission(stats, child, acorns, phaseSessions, journey.activeStage, levelState),
    journey,
    badges: badgeDefinitions(stats, child, rewardTypes),
  };
}

function buildCurrentMission(stats, child, acorns, phaseSessions, activeStage, levelState) {
  const milestone = buildNextMilestone(activeStage, child);
  const dailyCurrent = Math.min(1, stats.sessionsToday);
  const levelCurrent = Math.max(0, acorns - levelState.currentLevelStart);
  const levelTarget = Math.max(1, levelState.nextLevelAt - levelState.currentLevelStart);
  const levelRemaining = Math.max(0, levelState.nextLevelAt - acorns);

  return {
    title: activeStage?.title || 'Current Mission',
    subtitle: milestone.action,
    reward: milestone.reward || nextRewardName(stats, child, acorns),
    nextMilestone: milestone,
    ctaLabel: milestone.complete ? 'Open reward vault' : 'Start reading mission',
    ctaPath: milestone.complete ? '/rewards' : '/home',
    tasks: [
      {
        id: 'next_milestone',
        label: milestone.taskLabel,
        current: milestone.current,
        target: milestone.target,
        suffix: milestone.suffix,
        complete: milestone.complete,
        detail: milestone.remainingText,
        hint: milestone.when,
      },
      {
        id: 'daily_read',
        label: 'Read 1 story today',
        current: dailyCurrent,
        target: 1,
        complete: dailyCurrent >= 1,
        detail: dailyCurrent >= 1 ? 'Daily practice done today.' : 'One completed read keeps the habit warm.',
        hint: dailyCurrent >= 1 ? 'Come back tomorrow to grow the streak.' : 'Open Home, choose a story, and collect acorns after a passing read.',
      },
      {
        id: 'next_level',
        label: `Reach Level ${levelState.level + 1}`,
        current: Math.min(levelTarget, levelCurrent),
        target: levelTarget,
        complete: levelRemaining <= 0,
        detail: `${levelRemaining} acorns to the next reader level.`,
        hint: 'Passing read-aloud missions usually award 10 to 15 acorns.',
      },
    ],
  };
}

function buildNextMilestone(stage, child) {
  const safeStage = stage || {};
  const current = Math.max(0, Number(safeStage.current) || 0);
  const target = Math.max(1, Number(safeStage.target) || 1);
  const suffix = safeStage.suffix || '';
  const remaining = Math.max(0, target - current);
  const complete = Boolean(safeStage.complete || remaining <= 0);
  const reward = safeStage.reward || 'Reward Chest';
  const title = safeStage.title || 'Sound Forest';

  return {
    stageId: safeStage.id || 'sound_forest',
    title,
    goal: safeStage.goal || 'Complete practice to unlock.',
    taskLabel: taskLabelForStage(safeStage, child),
    reward,
    metric: safeStage.metric || 'stories',
    current,
    target,
    suffix,
    progress: Math.min(1, current / target),
    currentLabel: `${current}${suffix} / ${target}${suffix}`,
    remaining,
    complete,
    remainingText: complete
      ? `${reward} is unlocked.`
      : remainingTextForStage(safeStage, remaining, reward, child),
    action: actionForStage(safeStage, child),
    when: complete
      ? 'This milestone is complete. Open the vault to see the reward.'
      : whenForStage(safeStage, remaining, child),
  };
}

function taskLabelForStage(stage, child) {
  if (stage.metric === 'score') return `Score ${stage.target}${stage.suffix || '%'} once`;
  if (stage.metric === 'phase') return `Finish Phase ${child.phase} reads`;
  if (stage.metric === 'acorns') return `Collect ${stage.target} acorns`;
  return `Complete ${stage.target} story mission${stage.target === 1 ? '' : 's'}`;
}

function remainingTextForStage(stage, remaining, reward, child) {
  const unlockVerb = remaining === 1 ? 'unlocks' : 'unlock';
  if (stage.metric === 'score') {
    return `${remaining}${stage.suffix || '%'} more on the best read-aloud score unlocks ${reward}.`;
  }
  if (stage.metric === 'phase') {
    return `${remaining} more Phase ${child.phase} read${remaining === 1 ? '' : 's'} ${unlockVerb} ${reward}.`;
  }
  if (stage.metric === 'acorns') {
    return `${remaining} more acorn${remaining === 1 ? '' : 's'} ${unlockVerb} ${reward}.`;
  }
  return `${remaining} more story mission${remaining === 1 ? '' : 's'} ${unlockVerb} ${reward}.`;
}

function actionForStage(stage, child) {
  if (stage.metric === 'score') {
    return `Listen to the line, practise tricky words, then read aloud until one score reaches ${stage.target}${stage.suffix || '%'}.`;
  }
  if (stage.metric === 'phase') {
    return `Choose Phase ${child.phase} stories from Home and finish each read aloud with a passing score.`;
  }
  if (stage.metric === 'acorns') {
    return 'Complete read-aloud missions and collect acorns after each passing score.';
  }
  return 'Open Home, choose a story, read it aloud, then collect acorns after a passing score.';
}

function whenForStage(stage, remaining, child) {
  if (stage.metric === 'score') {
    return `As soon as one read-aloud reaches ${stage.target}${stage.suffix || '%'} or more.`;
  }
  if (stage.metric === 'phase') {
    return `After ${remaining} more completed Phase ${child.phase} read${remaining === 1 ? '' : 's'}.`;
  }
  if (stage.metric === 'acorns') {
    return `About ${Math.max(1, Math.ceil(remaining / 10))} passing read${remaining <= 10 ? '' : 's'} if each earns around 10+ acorns.`;
  }
  return `After ${remaining} more completed story mission${remaining === 1 ? '' : 's'}.`;
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
