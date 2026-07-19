import { v4 as uuid } from 'uuid';
import { getDb, rowChild, rowStory, rowSession, rowReward } from './index.js';

export const childrenRepo = {
  create({ name, interests = [], phase = 2 }) {
    const id = uuid();
    getDb()
      .prepare(
        `INSERT INTO children (id, name, interests, phase)
         VALUES (?, ?, ?, ?)`,
      )
      .run(id, name, JSON.stringify(interests), phase);
    return this.get(id);
  },

  get(id) {
    return rowChild(getDb().prepare('SELECT * FROM children WHERE id = ?').get(id));
  },

  list() {
    return getDb()
      .prepare('SELECT * FROM children ORDER BY created_at DESC')
      .all()
      .map(rowChild);
  },

  update(id, patch) {
    const current = this.get(id);
    if (!current) return null;
    const next = {
      name: patch.name ?? current.name,
      interests: patch.interests ?? current.interests,
      phase: patch.phase ?? current.phase,
      acorns: patch.acorns ?? current.acorns,
      streak: patch.streak ?? current.streak,
      lastReadAt: patch.lastReadAt ?? current.lastReadAt,
    };
    getDb()
      .prepare(
        `UPDATE children
         SET name = ?, interests = ?, phase = ?, acorns = ?, streak = ?,
             last_read_at = ?, updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(
        next.name,
        JSON.stringify(next.interests),
        next.phase,
        next.acorns,
        next.streak,
        next.lastReadAt,
        id,
      );
    return this.get(id);
  },
};

export const storiesRepo = {
  create(story) {
    const id = story.id || uuid();
    getDb()
      .prepare(
        `INSERT INTO stories (id, phase, theme, title, text, illustration_url, pdf_path, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        story.phase,
        story.theme,
        story.title,
        story.text,
        story.illustrationUrl || null,
        story.pdfPath || null,
        JSON.stringify(story.metadata || {}),
      );
    return this.get(id);
  },

  get(id) {
    return rowStory(getDb().prepare('SELECT * FROM stories WHERE id = ?').get(id));
  },

  updatePaths(id, { illustrationUrl, pdfPath }) {
    getDb()
      .prepare(
        `UPDATE stories SET illustration_url = COALESCE(?, illustration_url),
         pdf_path = COALESCE(?, pdf_path) WHERE id = ?`,
      )
      .run(illustrationUrl ?? null, pdfPath ?? null, id);
    return this.get(id);
  },

  latestForPhase(phase) {
    return rowStory(
      getDb()
        .prepare('SELECT * FROM stories WHERE phase = ? ORDER BY created_at DESC LIMIT 1')
        .get(phase),
    );
  },

  recentForPhaseTheme(phase, theme, limit = 5) {
    return getDb()
      .prepare(
        `SELECT * FROM stories
         WHERE phase = ? AND theme = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(phase, theme, Number(limit) || 5)
      .map(rowStory);
  },
};

export const sessionsRepo = {
  create({ childId, storyId }) {
    const id = uuid();
    getDb()
      .prepare(
        `INSERT INTO sessions (id, child_id, story_id, status)
         VALUES (?, ?, ?, 'active')`,
      )
      .run(id, childId, storyId);
    return this.get(id);
  },

  get(id) {
    return rowSession(getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id));
  },

  update(id, { status, jaccardScore, endedAt }) {
    getDb()
      .prepare(
        `UPDATE sessions
         SET status = COALESCE(?, status),
             jaccard_score = COALESCE(?, jaccard_score),
             ended_at = COALESCE(?, ended_at)
         WHERE id = ?`,
      )
      .run(status ?? null, jaccardScore ?? null, endedAt ?? null, id);
    return this.get(id);
  },

  listForChild(childId) {
    return getDb()
      .prepare('SELECT * FROM sessions WHERE child_id = ? ORDER BY started_at DESC')
      .all(childId)
      .map(rowSession);
  },
};

export const assessmentsRepo = {
  create(row) {
    const id = uuid();
    getDb()
      .prepare(
        `INSERT INTO assessments
         (id, session_id, expected, recognized, phoneme_scores, jaccard_words, jaccard_phonemes, path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        row.sessionId,
        row.expected,
        row.recognized,
        JSON.stringify(row.phonemeScores || {}),
        row.jaccardWords ?? null,
        row.jaccardPhonemes ?? null,
        row.path || 'whisper',
      );
    return id;
  },
};

export const rewardsRepo = {
  create({ childId, type, label, meta = {} }) {
    const id = uuid();
    getDb()
      .prepare(
        `INSERT INTO rewards (id, child_id, type, label, meta)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, childId, type, label, JSON.stringify(meta));
    return rowReward(getDb().prepare('SELECT * FROM rewards WHERE id = ?').get(id));
  },

  listForChild(childId) {
    return getDb()
      .prepare('SELECT * FROM rewards WHERE child_id = ? ORDER BY earned_at DESC')
      .all(childId)
      .map(rowReward);
  },

  hasType(childId, type) {
    return Boolean(
      getDb()
        .prepare('SELECT 1 FROM rewards WHERE child_id = ? AND type = ? LIMIT 1')
        .get(childId, type),
    );
  },
};
