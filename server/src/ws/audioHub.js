import { WebSocketServer } from 'ws';
import { sessionsRepo, storiesRepo } from '../db/repositories.js';
import {
  assessHeuristic,
  assessRecording,
  persistAssessment,
  MIN_AUDIO_BYTES,
} from '../services/assessmentService.js';
import { hasOpenAIKey } from '../services/openaiClient.js';
import { config } from '../config.js';
import { recordChildActivity } from '../services/activityService.js';

/**
 * WebSocket audio hub:
 * - client streams binary mic audio
 * - on end: Whisper transcription + pronunciation score vs expected text
 */
export function attachAudioHub(server) {
  const wss = new WebSocketServer({ server, path: '/ws/audio' });

  wss.on('connection', (ws) => {
    const state = {
      sessionId: null,
      expectedText: '',
      chunks: [],
      lastPing: Date.now(),
      degraded: false,
      interim: '',
      peakLevel: 0,
      attemptId: 0,
    };

    const send = (type, payload = {}) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type, ...payload }));
      }
    };

    send('ready', {
      mockMode: config.mockMode,
      hasOpenAIKey: hasOpenAIKey(),
      jaccardThreshold: config.jaccardThreshold,
      minAudioBytes: MIN_AUDIO_BYTES,
      message: 'Audio channel ready — read aloud for scoring',
    });

    const heartbeat = setInterval(() => {
      if (Date.now() - state.lastPing > 25000) {
        state.degraded = true;
        send('degraded', {
          message: 'Connection looks unstable. Keep reading — we will score at the end.',
        });
      }
      send('ping', { t: Date.now() });
    }, 10000);

    ws.on('message', async (data, isBinary) => {
      try {
        if (isBinary) {
          state.chunks.push(Buffer.from(data));
          if (state.chunks.length % 8 === 0) {
            send('chunk_ack', {
              count: state.chunks.length,
              bytes: state.chunks.reduce((n, b) => n + b.length, 0),
              degraded: state.degraded,
            });
          }
          return;
        }

        const msg = JSON.parse(data.toString());
        if (msg.type === 'pong') {
          state.lastPing = Date.now();
          if (state.degraded) {
            state.degraded = false;
            send('recovered', { message: 'Connection looks healthy again.' });
          }
          return;
        }

        if (msg.type === 'start') {
          const session = sessionsRepo.get(msg.sessionId);
          if (!session) {
            send('error', { message: 'Unknown session' });
            return;
          }
          const story = storiesRepo.get(session.storyId);
          recordChildActivity(session.childId, { type: 'audio_session_start' });
          state.sessionId = session.id;
          state.attemptId = Number(msg.attemptId) || state.attemptId + 1;
          state.expectedText =
            (typeof msg.expectedText === 'string' && msg.expectedText.trim()) ||
            story?.text ||
            '';
          state.chunks = [];
          state.interim = '';
          state.peakLevel = 0;
          send('session_bound', {
            sessionId: session.id,
            attemptId: state.attemptId,
            expectedChars: state.expectedText.length,
            expectedPreview: state.expectedText.slice(0, 80),
          });
          return;
        }

        if (msg.type === 'set_expected') {
          if (typeof msg.expectedText === 'string' && msg.expectedText.trim()) {
            state.expectedText = msg.expectedText.trim();
            send('expected_set', {
              expectedChars: state.expectedText.length,
              expectedPreview: state.expectedText.slice(0, 80),
            });
          }
          return;
        }

        if (msg.type === 'interim') {
          // Typed interim is practice-only feedback — not a substitute for mic scoring
          state.interim = msg.transcript || '';
          if (!state.interim.trim()) return;
          const result = assessHeuristic(state.expectedText, state.interim);
          send('assessment', {
            path: 'heuristic',
            validation: result.validation,
            transcript: state.interim,
            encourage: result.validation.passed
              ? 'That typed line looks close — now read it aloud for a real score.'
              : 'Keep practising the missing words, then read aloud.',
          });
          return;
        }

        if (msg.type === 'quality') {
          const level = msg.level ?? 0;
          if (level > state.peakLevel) state.peakLevel = level;
          send('quality_ack', {
            level,
            silent: Boolean(msg.silent),
            advice: msg.silent
              ? 'I can barely hear you — a little louder please!'
              : level > 0.85
                ? 'A tiny bit softer would help.'
                : 'Audio level looks good.',
          });
          return;
        }

        if (msg.type === 'end') {
          const mime = msg.mime || 'audio/webm';
          const attemptId = Number(msg.attemptId) || state.attemptId;
          // Client may send the exact target line (selected sentence) with the end event
          if (typeof msg.expectedText === 'string' && msg.expectedText.trim()) {
            state.expectedText = msg.expectedText.trim();
          }
          const audioBuffer = Buffer.concat(state.chunks);
          state.chunks = [];
          const typed = String(msg.transcript || state.interim || '').trim();
          const allowTyped = Boolean(msg.allowTypedFallback) && typed.length > 0;

          send('assessing', {
            attemptId,
            message: 'Listening to your reading…',
            audioBytes: audioBuffer.length,
            expectedPreview: state.expectedText.slice(0, 80),
          });

          const result = await assessRecording({
            expectedText: state.expectedText,
            audioBuffer,
            mime,
            typedTranscript: typed,
            allowTypedFallback: allowTyped,
          });

          const isCurrentAttempt = attemptId === state.attemptId;
          if (state.sessionId && isCurrentAttempt) {
            persistAssessment(state.sessionId, result);
          }

          const passed = Boolean(result.validation?.passed);
          const v = result.validation || {};
          send('final_assessment', {
            ...result,
            attemptId,
            stale: !isCurrentAttempt,
            passed,
            action: passed ? 'complete_allowed' : 'retry',
            message:
              result.message ||
              (passed
                ? 'Wonderful reading! You may collect your acorns.'
                : 'That did not quite match. Listen again, then read the sentence clearly.'),
            scoreSummary: {
              combined: v.combined,
              displayScore: v.displayScore,
              coverage: v.coverage,
              sequence: v.sequence,
              jaccardWords: v.jaccardWords,
              jaccardPhonemes: v.jaccardPhonemes,
              missingWords: v.missingWords || [],
              wordScores: v.wordScores || [],
              reason: v.reason,
              scorer: v.scorer,
            },
          });
          return;
        }

        if (msg.type === 'retry') {
          state.attemptId = Number(msg.attemptId) || state.attemptId + 1;
          state.chunks = [];
          state.interim = '';
          state.peakLevel = 0;
          send('retry_ack', {
            attemptId: state.attemptId,
            message: 'Ready when you are — take a breath and begin.',
          });
        }
      } catch (err) {
        console.error('WS audio error', err);
        send('error', { message: err.message || 'audio processing error' });
      }
    });

    ws.on('close', () => clearInterval(heartbeat));
  });

  return wss;
}
