import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import sharp from 'sharp';
import { config } from '../config.js';
import { childrenRepo, rewardsRepo, sessionsRepo, storiesRepo } from '../db/repositories.js';
import { recordChildActivity, sameUtcDay } from '../services/activityService.js';

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

router.post('/:id/activity', (req, res) => {
  const type = String(req.body?.type || 'phonics_activity')
    .replace(/[^a-z0-9_-]/gi, '')
    .slice(0, 40) || 'phonics_activity';
  const result = recordChildActivity(req.params.id, { type });
  if (!result) return res.status(404).json({ error: 'not found' });
  res.json(result);
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
  const activeToday = sameUtcDay(child.lastReadAt, new Date().toISOString());
  const averageJaccard =
    completed.length === 0
      ? 0
      : completed.reduce((a, s) => a + (s.jaccardScore || 0), 0) / completed.length;
  const bestScore = completed.reduce((best, s) => Math.max(best, s.jaccardScore || 0), 0);

  return {
    completedSessions: completed.length,
    verifiedMissions: completed.length,
    sessionsToday,
    activeToday,
    lastActivityAt: child.lastReadAt,
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
      title: 'Do one phonics activity today',
      current: stats.activeToday ? 1 : 0,
      target: 1,
      complete: Boolean(stats.activeToday),
      reward: 'Keep your day streak alive',
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
  const activityCurrent = stats.activeToday ? 1 : 0;
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
        label: 'Do 1 phonics activity today',
        current: activityCurrent,
        target: 1,
        complete: activityCurrent >= 1,
        detail: activityCurrent >= 1 ? 'Day streak counted today.' : 'One reading or listening action keeps the streak warm.',
        hint: activityCurrent >= 1 ? 'Come back tomorrow to keep the streak going.' : 'Open a story, listen to a line, or start reading aloud.',
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
  if (stage.metric === 'score') return `Complete a verified ${stage.target}${stage.suffix || '%'} mission`;
  if (stage.metric === 'phase') return `Finish verified Phase ${child.phase} missions`;
  if (stage.metric === 'acorns') return `Collect ${stage.target} acorns`;
  return `Complete ${stage.target} verified story mission${stage.target === 1 ? '' : 's'}`;
}

function remainingTextForStage(stage, remaining, reward, child) {
  const unlockVerb = remaining === 1 ? 'unlocks' : 'unlock';
  if (stage.metric === 'score') {
    return `${remaining}${stage.suffix || '%'} more on the best read-aloud score unlocks ${reward}.`;
  }
  if (stage.metric === 'phase') {
    return `${remaining} more verified Phase ${child.phase} mission${remaining === 1 ? '' : 's'} ${unlockVerb} ${reward}.`;
  }
  if (stage.metric === 'acorns') {
    return `${remaining} more acorn${remaining === 1 ? '' : 's'} ${unlockVerb} ${reward}.`;
  }
  return `${remaining} more verified story mission${remaining === 1 ? '' : 's'} ${unlockVerb} ${reward}.`;
}

function actionForStage(stage, child) {
  if (stage.metric === 'score') {
    return `Pass every sentence in a story, then collect rewards with an overall score of ${stage.target}${stage.suffix || '%'} or more.`;
  }
  if (stage.metric === 'phase') {
    return `Choose Phase ${child.phase} stories from Home, pass every sentence, then collect the mission reward.`;
  }
  if (stage.metric === 'acorns') {
    return 'Complete verified read-aloud missions to collect acorns.';
  }
  return 'Open Home, choose a story, pass every sentence aloud, then collect acorns.';
}

function whenForStage(stage, remaining, child) {
  if (stage.metric === 'score') {
    return `After a completed story mission reaches ${stage.target}${stage.suffix || '%'} overall.`;
  }
  if (stage.metric === 'phase') {
    return `After ${remaining} more verified Phase ${child.phase} mission${remaining === 1 ? '' : 's'}.`;
  }
  if (stage.metric === 'acorns') {
    return `About ${Math.max(1, Math.ceil(remaining / 10))} passing read${remaining <= 10 ? '' : 's'} if each earns around 10+ acorns.`;
  }
  return `After ${remaining} more verified story mission${remaining === 1 ? '' : 's'}.`;
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
      goal: 'Complete 1 verified story mission.',
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
      goal: 'Complete 3 verified story missions.',
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
      goal: `Complete 5 verified Phase ${child.phase} missions.`,
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
      goal: 'Finish a verified mission at 80% or more.',
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
      goal: 'Finish a verified mission at 90% or more.',
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
      hint: 'Complete your first verified mission.',
      earned: rewardTypes.has('trophy_first_story') || stats.completedSessions >= 1,
      progress: Math.min(1, stats.completedSessions / 1),
    },
    {
      type: 'trophy_five_stories',
      icon: 'trail',
      label: 'Story Trail',
      hint: 'Complete 5 verified story missions.',
      earned: rewardTypes.has('trophy_five_stories') || stats.completedSessions >= 5,
      progress: Math.min(1, stats.completedSessions / 5),
    },
    {
      type: 'trophy_clear_reader',
      icon: 'voice',
      label: 'Clear Reader',
      hint: 'Complete a verified mission at 90%.',
      earned: rewardTypes.has('trophy_clear_reader') || stats.bestScore >= 0.9,
      progress: Math.min(1, stats.bestScore / 0.9),
    },
    {
      type: 'trophy_phase_star',
      icon: 'phase',
      label: 'Phase Star',
      hint: 'Complete a verified mission at 80%.',
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
