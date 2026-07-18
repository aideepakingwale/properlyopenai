import { childrenRepo, rewardsRepo, sessionsRepo } from '../db/repositories.js';

function sameUtcDay(a, b) {
  if (!a || !b) return false;
  return String(a).slice(0, 10) === String(b).slice(0, 10);
}

function yesterdayOf(iso) {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString();
}

/**
 * Award acorns, update streak, and grant trophies after a validated session.
 */
export function awardSessionRewards(childId, { jaccardScore = 0 } = {}) {
  const child = childrenRepo.get(childId);
  if (!child) return { child: null, rewards: [] };

  const now = new Date().toISOString();
  let streak = child.streak || 0;
  if (child.lastReadAt && sameUtcDay(child.lastReadAt, now)) {
    // same day — keep streak
  } else if (child.lastReadAt && sameUtcDay(child.lastReadAt, yesterdayOf(now))) {
    streak += 1;
  } else {
    streak = 1;
  }

  const acornGain = Math.max(3, Math.round(5 + jaccardScore * 10));
  const acorns = (child.acorns || 0) + acornGain;
  const updated = childrenRepo.update(childId, {
    acorns,
    streak,
    lastReadAt: now,
  });

  const rewards = [];
  rewards.push(
    rewardsRepo.create({
      childId,
      type: 'acorns',
      label: `+${acornGain} acorns`,
      meta: { amount: acornGain, jaccardScore },
    }),
  );

  if (streak > 0 && streak % 3 === 0) {
    rewards.push(
      rewardsRepo.create({
        childId,
        type: 'streak',
        label: `${streak}-day streak!`,
        meta: { streak },
      }),
    );
  }

  const completed = sessionsRepo
    .listForChild(childId)
    .filter((s) => s.status === 'completed').length;

  const trophyChecks = [
    { type: 'trophy_first_story', label: 'First Story Trophy', when: completed + 1 >= 1 },
    { type: 'trophy_five_stories', label: 'Five Stories Trophy', when: completed + 1 >= 5 },
    { type: 'trophy_phase_star', label: 'Phase Star', when: jaccardScore >= 0.8 },
  ];

  for (const t of trophyChecks) {
    if (t.when && !rewardsRepo.hasType(childId, t.type)) {
      rewards.push(
        rewardsRepo.create({
          childId,
          type: t.type,
          label: t.label,
          meta: { jaccardScore, completed: completed + 1 },
        }),
      );
    }
  }

  return { child: updated, rewards, acornGain, streak };
}
