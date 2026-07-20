import { childrenRepo, rewardsRepo, sessionsRepo } from '../db/repositories.js';
import { recordChildActivity } from './activityService.js';

/**
 * Award acorns, update streak, and grant trophies after a validated session.
 */
export function awardSessionRewards(childId, { jaccardScore = 0 } = {}) {
  const activity = recordChildActivity(childId, { type: 'verified_reading_reward' });
  const child = activity?.child || childrenRepo.get(childId);
  if (!child) return { child: null, rewards: [] };

  const acornGain = Math.max(3, Math.round(5 + jaccardScore * 10));
  const acorns = (child.acorns || 0) + acornGain;
  const updated = childrenRepo.update(childId, {
    acorns,
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

  const streak = updated.streak || 0;
  const hasThisStreakReward = rewardsRepo
    .listForChild(childId)
    .some((r) => r.type === 'streak' && Number(r.meta?.streak) === streak);
  if (streak > 0 && streak % 3 === 0 && !hasThisStreakReward) {
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
    { type: 'trophy_first_story', label: 'First Story Trophy', when: completed >= 1 },
    { type: 'trophy_five_stories', label: 'Five Stories Trophy', when: completed >= 5 },
    { type: 'trophy_ten_stories', label: 'Ten Story Trailblazer', when: completed >= 10 },
    { type: 'trophy_phase_star', label: 'Phase Star', when: jaccardScore >= 0.8 },
    { type: 'trophy_clear_reader', label: 'Clear Reader Badge', when: jaccardScore >= 0.9 },
    { type: 'trophy_super_listener', label: 'Super Listener Badge', when: completed >= 3 },
    { type: 'trophy_acorn_collector', label: 'Acorn Collector Badge', when: acorns >= 50 },
    { type: 'trophy_oak_guardian', label: 'Oak Guardian Badge', when: acorns >= 100 },
  ];

  for (const t of trophyChecks) {
    if (t.when && !rewardsRepo.hasType(childId, t.type)) {
      rewards.push(
        rewardsRepo.create({
          childId,
          type: t.type,
          label: t.label,
          meta: { jaccardScore, completed },
        }),
      );
    }
  }

  return { child: updated, rewards, acornGain, streak };
}
