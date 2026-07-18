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

export const config = {
  port: Number(process.env.PORT || 3001),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  mockMode: mockFlag || !hasKey,
  jaccardThreshold: Number(process.env.JACCARD_THRESHOLD || 0.55),
  ttsVoice: process.env.TTS_VOICE || 'nova',
  storageDir: path.resolve(serverRoot, process.env.STORAGE_DIR || 'storage'),
  dbPath: path.resolve(serverRoot, process.env.DB_PATH || 'data/properly.db'),
  serveClient: String(process.env.SERVE_CLIENT || 'true').toLowerCase() !== 'false',
  clientDist,
  serverRoot,
  root,
};

export default config;
