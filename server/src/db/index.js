import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { SCHEMA_SQL } from './schema.js';

let db;

export function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  return db;
}

export function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function rowChild(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    interests: parseJson(row.interests, []),
    phase: row.phase,
    acorns: row.acorns,
    streak: row.streak,
    lastReadAt: row.last_read_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowStory(row) {
  if (!row) return null;
  return {
    id: row.id,
    phase: row.phase,
    theme: row.theme,
    title: row.title,
    text: row.text,
    illustrationUrl: row.illustration_url,
    pdfPath: row.pdf_path,
    metadata: parseJson(row.metadata, {}),
    createdAt: row.created_at,
  };
}

export function rowSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    childId: row.child_id,
    storyId: row.story_id,
    status: row.status,
    jaccardScore: row.jaccard_score,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

export function rowReward(row) {
  if (!row) return null;
  return {
    id: row.id,
    childId: row.child_id,
    type: row.type,
    label: row.label,
    meta: parseJson(row.meta, {}),
    earnedAt: row.earned_at,
  };
}
