import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const serverRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(serverRoot, '.env') });

const mockFlag = String(process.env.MOCK_MODE || '').toLowerCase() === 'true';
const hasKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());

const clientDist = path.resolve(root, 'client', 'dist');

/**
 * Chat defaults target Cursor/OpenAI free daily shared traffic (mini pool).
 * Image / Whisper / TTS models are outside that free allowance and are cached or optional.
 */
const chatModel = (process.env.OPENAI_CHAT_MODEL || process.env.CHAT_MODEL || 'gpt-4o-mini').trim();
const illustrationsEnabled =
  String(process.env.ILLUSTRATIONS_ENABLED || 'true').toLowerCase() !== 'false';

export const config = {
  port: Number(process.env.PORT || 3001),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  mockMode: mockFlag || !hasKey,
  /** Stories + Mrs Owl coach — prefer free-tier mini models */
  chatModel,
  jaccardThreshold: Number(process.env.JACCARD_THRESHOLD || 0.72),
  ttsVoice: process.env.TTS_VOICE || 'nova',
  /** gpt-image / DALL·E are billable — disable to stay on free chat limits only */
  illustrationsEnabled,
  illustrationModel: (process.env.ILLUSTRATION_MODEL || 'gpt-image-1-mini').trim(),
  illustrationQuality: (process.env.ILLUSTRATION_QUALITY || 'low').trim(),
  illustrationSize: (process.env.ILLUSTRATION_SIZE || '').trim(),
  illustrationFormat: (process.env.ILLUSTRATION_FORMAT || 'webp').trim(),
  illustrationCompression: Number(process.env.ILLUSTRATION_COMPRESSION || 70),
  storageDir: path.resolve(serverRoot, process.env.STORAGE_DIR || 'storage'),
  dbPath: path.resolve(serverRoot, process.env.DB_PATH || 'data/properly.db'),
  serveClient: String(process.env.SERVE_CLIENT || 'true').toLowerCase() !== 'false',
  clientDist,
  serverRoot,
  root,
};

export default config;
