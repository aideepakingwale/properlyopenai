import fs from 'fs';
import http from 'http';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { getDb } from './db/index.js';
import childrenRoutes from './routes/children.js';
import storiesRoutes from './routes/stories.js';
import sessionsRoutes from './routes/sessions.js';
import coachRoutes from './routes/coach.js';
import phonicsRoutes from './routes/phonics.js';
import { attachAudioHub } from './ws/audioHub.js';

fs.mkdirSync(config.storageDir, { recursive: true });
getDb();

const app = express();

const origins = String(config.clientOrigin)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || origins.includes('*') || origins.includes(origin)) {
        cb(null, true);
        return;
      }
      // Same-origin production (SPA served by this server) has no Origin issues for nav;
      // allow common local defaults during mixed setups.
      if (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        cb(null, true);
        return;
      }
      cb(null, false);
    },
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use('/storage', express.static(config.storageDir));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    name: 'Properly API',
    mockMode: config.mockMode,
    jaccardThreshold: config.jaccardThreshold,
  });
});

app.use('/api/children', childrenRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/phonics', phonicsRoutes);

const clientIndex = path.join(config.clientDist, 'index.html');
if (config.serveClient && fs.existsSync(clientIndex)) {
  app.use(express.static(config.clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/storage') || req.path.startsWith('/ws')) {
      next();
      return;
    }
    res.sendFile(clientIndex);
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'server error' });
});

const server = http.createServer(app);
attachAudioHub(server);

server.listen(config.port, () => {
  console.log(`Properly API on http://localhost:${config.port}`);
  console.log(`Mock mode: ${config.mockMode}`);
  console.log(`Storage: ${config.storageDir}`);
  console.log(`DB: ${config.dbPath}`);
  if (config.serveClient && fs.existsSync(clientIndex)) {
    console.log(`Serving SPA from ${config.clientDist}`);
  }
});
