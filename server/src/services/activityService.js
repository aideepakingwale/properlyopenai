import { childrenRepo } from '../db/repositories.js';

export function sameUtcDay(a, b) {
  if (!a || !b) return false;
  return String(a).slice(0, 10) === String(b).slice(0, 10);
}

export function yesterdayOf(iso) {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString();
}

/**
 * Count one child activity day once, then keep the last activity timestamp fresh.
 * Reading, listening, and mic attempts can all call this safely.
 */
export function recordChildActivity(childId, { type = 'phonics_activity' } = {}) {
  const child = childrenRepo.get(childId);
  if (!child) return null;

  const now = new Date().toISOString();
  const alreadyToday = sameUtcDay(child.lastReadAt, now);
  let streak = child.streak || 0;

  if (alreadyToday) {
    // Keep the streak, but refresh last activity time for the grown-up view.
  } else if (child.lastReadAt && sameUtcDay(child.lastReadAt, yesterdayOf(now))) {
    streak += 1;
  } else {
    streak = 1;
  }

  const updated = childrenRepo.update(child.id, {
    streak,
    lastReadAt: now,
  });

  return {
    child: updated,
    activity: {
      type,
      countedForStreak: !alreadyToday,
      activeToday: true,
      at: now,
      streak,
    },
  };
}
