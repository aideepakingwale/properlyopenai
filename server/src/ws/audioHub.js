import { WebSocketServer } from 'ws';
import { sessionsRepo, storiesRepo } from '../db/repositories.js';
import {
  assessHeuristic,
  assessWithWhisper,
  persistAssessment,
} from '../services/assessmentService.js';
import { config } from '../config.js';

/**
 * WebSocket audio hub:
 * - client sends JSON control + binary audio chunks
 * - dual-path assessment (heuristic interim + Whisper on end)
 * - Jaccard gate feedback + heartbeat / recovery
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
    };

    const send = (type, payload = {}) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type, ...payload }));
      }
    };

    send('ready', {
      mockMode: config.mockMode,
      jaccardThreshold: config.jaccardThreshold,
      message: 'Audio channel ready',
    });

    const heartbeat = setInterval(() => {
      if (Date.now() - state.lastPing > 25000) {
        state.degraded = true;
        send('degraded', {
          message: 'Connection looks unstable. We will use Whisper at the end.',
        });
      }
      send('ping', { t: Date.now() });
    }, 10000);

    ws.on('message', async (data, isBinary) => {
      try {
        if (isBinary) {
          state.chunks.push(Buffer.from(data));
          if (state.chunks.length % 8 === 0) {
            send('chunk_ack', { count: state.chunks.length, degraded: state.degraded });
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
          state.sessionId = session.id;
          // Optional expectedText: assess one sentence instead of the whole story
          state.expectedText =
            (typeof msg.expectedText === 'string' && msg.expectedText.trim()) ||
            story?.text ||
            '';
          state.chunks = [];
          state.interim = '';
          send('session_bound', {
            sessionId: session.id,
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
          state.interim = msg.transcript || '';
          const result = assessHeuristic(state.expectedText, state.interim);
          send('assessment', {
            path: 'heuristic',
            validation: result.validation,
            transcript: state.interim,
            encourage: result.validation.passed
              ? 'Sounding great — keep going!'
              : 'Nice try — match more of the story words.',
          });
          return;
        }

        if (msg.type === 'quality') {
          send('quality_ack', {
            level: msg.level ?? 0,
            silent: Boolean(msg.silent),
            advice: msg.silent
              ? 'I can barely hear you — a little louder please!'
              : msg.level > 0.85
                ? 'A tiny bit softer would help.'
                : 'Audio level looks good.',
          });
          return;
        }

        if (msg.type === 'end') {
          const mime = msg.mime || 'audio/webm';
          const audioBuffer = Buffer.concat(state.chunks);
          let result;
          if (audioBuffer.length > 0 && !config.mockMode) {
            result = await assessWithWhisper(state.expectedText, audioBuffer, mime);
          } else if (state.interim) {
            result = assessHeuristic(state.expectedText, state.interim);
            result.path = state.degraded ? 'heuristic-degraded' : 'heuristic';
          } else {
            // Mock end: use client final transcript or partial story words
            const finalTranscript = msg.transcript || state.interim || '';
            result = await assessWithWhisper(state.expectedText, Buffer.alloc(0), mime);
            if (finalTranscript) {
              result = assessHeuristic(state.expectedText, finalTranscript);
              result.path = 'client-final';
            }
          }

          if (state.sessionId) {
            persistAssessment(state.sessionId, result);
          }

          const passed = result.validation.passed;
          send('final_assessment', {
            ...result,
            passed,
            action: passed ? 'complete_allowed' : 'retry',
            message: passed
              ? 'Wonderful reading! You may collect your acorns.'
              : 'That did not quite match the page. Shall we try again?',
          });
          state.chunks = [];
          return;
        }

        if (msg.type === 'retry') {
          state.chunks = [];
          state.interim = '';
          send('retry_ack', { message: 'Ready when you are — take a breath and begin.' });
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
