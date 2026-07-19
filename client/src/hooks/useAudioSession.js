import { useCallback, useEffect, useRef, useState } from 'react';
import { wsAudioUrl } from '../api';

/**
 * Browser mic capture + WebSocket streaming.
 * On stop: waits for the final audio blob, then asks the server to Whisper-score it.
 */
export function useAudioSession({ sessionId, onAssessment, onFinal, onQuality }) {
  const wsRef = useRef(null);
  const mediaRef = useRef(null);
  const recorderRef = useRef(null);
  const analyserRef = useRef(null);
  const recognitionRef = useRef(null);
  const rafRef = useRef(null);
  const expectedTextRef = useRef('');
  const chunksRef = useRef([]);
  const mimeRef = useRef('audio/webm');
  const attemptRef = useRef(0);
  const recordingRef = useRef(false);
  const preparingRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const [recording, setRecording] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [level, setLevel] = useState(0);
  const [status, setStatus] = useState('idle');
  const [lastMessage, setLastMessage] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);

  const cleanupLoop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const setIdleStatus = (nextStatus) => {
    if (!recordingRef.current && !preparingRef.current) {
      setStatus(nextStatus);
    }
  };

  const stopSpeechRecognition = () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.stop();
    } catch {
      /* ignore */
    }
  };

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return;
    const ws = new WebSocket(wsAudioUrl());
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setIdleStatus('connected');
      if (sessionId && !recordingRef.current && !preparingRef.current) {
        ws.send(
          JSON.stringify({
            type: 'start',
            sessionId,
            expectedText: expectedTextRef.current || undefined,
          }),
        );
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setIdleStatus('reconnecting');
      setTimeout(() => connect(), 1500);
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', t: msg.t }));
          return;
        }
        if (msg.type === 'assessment') onAssessment?.(msg);
        if (msg.type === 'final_assessment') {
          if (msg.stale || (msg.attemptId && msg.attemptId !== attemptRef.current)) return;
          setStatus(msg.passed ? 'scored-pass' : 'scored-retry');
          onFinal?.(msg);
        }
        if (msg.type === 'assessing') {
          if (msg.attemptId && msg.attemptId !== attemptRef.current) return;
          setStatus('processing');
          if (msg.message) setLastMessage(msg.message);
        }
        if (msg.type === 'retry_ack') {
          if (msg.attemptId) attemptRef.current = msg.attemptId;
          setStatus('connected');
          if (msg.message) setLastMessage(msg.message);
        }
        if (msg.type === 'quality_ack') onQuality?.(msg);
        if (msg.type === 'error') {
          setLastMessage(msg.message || 'Audio error');
          setIdleStatus('error');
        }
        if (msg.message && msg.type !== 'ping') setLastMessage(msg.message);
        if (msg.type === 'degraded') setIdleStatus('degraded');
        if (msg.type === 'recovered') setIdleStatus('connected');
      } catch {
        /* ignore */
      }
    };
  }, [sessionId, onAssessment, onFinal, onQuality]);

  useEffect(() => {
    connect();
    return () => {
      cleanupLoop();
      wsRef.current?.close();
      try {
        recorderRef.current?.stop();
      } catch {
        /* ignore */
      }
      mediaRef.current?.getTracks().forEach((t) => t.stop());
      stopSpeechRecognition();
    };
  }, [connect]);

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    preparingRef.current = preparing;
  }, [preparing]);

  const sendInterim = useCallback((transcript) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'interim', transcript }));
    }
  }, []);

  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const supported = Boolean(SpeechRecognition);
    setSpeechSupported(supported);
    if (!supported) return;

    stopSpeechRecognition();
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-GB';
    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map((result) => result?.[0]?.transcript || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      setLiveTranscript(text);
      if (text) sendInterim(text);
    };
    recognition.onerror = () => {
      setSpeechSupported(false);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      /* Some browsers throw if recognition is already starting. */
    }
  }, [sendInterim]);

  useEffect(() => {
    if (
      connected &&
      sessionId &&
      wsRef.current?.readyState === 1 &&
      !recordingRef.current &&
      !preparingRef.current
    ) {
      wsRef.current.send(
        JSON.stringify({
          type: 'start',
          sessionId,
          expectedText: expectedTextRef.current || undefined,
        }),
      );
    }
  }, [connected, sessionId]);

  const setExpectedText = useCallback(
    (text) => {
      expectedTextRef.current = String(text || '').trim();
      if (wsRef.current?.readyState === 1 && sessionId) {
        if (expectedTextRef.current) {
          wsRef.current.send(
            JSON.stringify({ type: 'set_expected', expectedText: expectedTextRef.current }),
          );
        } else {
          wsRef.current.send(JSON.stringify({ type: 'start', sessionId }));
        }
      }
    },
    [sessionId],
  );

  const startRecording = async () => {
    if (recording || preparing) return;
    attemptRef.current += 1;
    chunksRef.current = [];
    setLiveTranscript('');
    recordingRef.current = false;
    preparingRef.current = true;
    setPreparing(true);
    setStatus('getting-ready');

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      mediaRef.current = stream;
    } catch (err) {
      preparingRef.current = false;
      setPreparing(false);
      setStatus('error');
      setLastMessage(err?.message || 'Microphone permission was not granted.');
      return;
    }

    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      setLevel(rms);
      const silent = rms < 0.02;
      if (wsRef.current?.readyState === 1) {
        wsRef.current.send(JSON.stringify({ type: 'quality', level: rms, silent }));
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();

    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    mimeRef.current = mime;
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorderRef.current = recorder;

    recorder.onstart = () => {
      startSpeechRecognition();
      preparingRef.current = false;
      recordingRef.current = true;
      setPreparing(false);
      setRecording(true);
      setStatus('recording');
      setLastMessage('Speak now.');
    };

    recorder.onerror = () => {
      preparingRef.current = false;
      recordingRef.current = false;
      setPreparing(false);
      setRecording(false);
      setStatus('error');
      setLastMessage('The microphone stopped unexpectedly. Please try again.');
    };

    recorder.ondataavailable = async (e) => {
      if (!e.data?.size) return;
      chunksRef.current.push(e.data);
      if (wsRef.current?.readyState === 1) {
        const buf = await e.data.arrayBuffer();
        wsRef.current.send(buf);
      }
    };

    // Clear prior audio on server for a fresh take
    if (wsRef.current?.readyState === 1 && sessionId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'start',
          sessionId,
          attemptId: attemptRef.current,
          expectedText: expectedTextRef.current || undefined,
        }),
      );
    }

    try {
      recorder.start(250);
    } catch (err) {
      preparingRef.current = false;
      recordingRef.current = false;
      setPreparing(false);
      setRecording(false);
      setStatus('error');
      setLastMessage(err?.message || 'Could not start microphone recording.');
      mediaRef.current?.getTracks().forEach((t) => t.stop());
    }
  };

  /**
   * Stop mic, flush final chunk to the socket, then request Whisper scoring.
   * @param {{ typedTranscript?: string, allowTypedFallback?: boolean }} [opts]
   */
  const stopRecording = (opts = {}) => {
    const typedTranscript =
      typeof opts === 'string' ? opts : opts.typedTranscript || '';
    const allowTypedFallback =
      typeof opts === 'object' ? Boolean(opts.allowTypedFallback) : false;
    const expectedText =
      typeof opts === 'object' && opts.expectedText != null
        ? String(opts.expectedText).trim()
        : expectedTextRef.current;

    if (expectedText) expectedTextRef.current = expectedText;

    cleanupLoop();
    stopSpeechRecognition();
    const recorder = recorderRef.current;
    preparingRef.current = false;
    recordingRef.current = false;
    setPreparing(false);
    setRecording(false);
    setStatus('processing');

    const finish = async () => {
      // Give the last binary frame a moment to arrive on the server
      await new Promise((r) => setTimeout(r, 250));
      if (wsRef.current?.readyState === 1) {
        // Re-bind expected line, then score — avoids stale full-story targets
        if (expectedText) {
          wsRef.current.send(
            JSON.stringify({ type: 'set_expected', expectedText }),
          );
        }
        wsRef.current.send(
          JSON.stringify({
            type: 'end',
            attemptId: attemptRef.current,
            mime: mimeRef.current || 'audio/webm',
            transcript: typedTranscript,
            allowTypedFallback,
            expectedText: expectedText || undefined,
          }),
        );
      }
      mediaRef.current?.getTracks().forEach((t) => t.stop());
    };

    if (recorder && recorder.state !== 'inactive') {
      recorder.addEventListener(
        'stop',
        () => {
          finish();
        },
        { once: true },
      );
      try {
        if (recorder.state === 'recording') recorder.requestData();
      } catch {
        /* ignore */
      }
      recorder.stop();
    } else {
      finish();
    }
  };

  const requestRetry = () => {
    attemptRef.current += 1;
    setLiveTranscript('');
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'retry', attemptId: attemptRef.current }));
    }
    setStatus('connected');
  };

  return {
    connected,
    recording,
    preparing,
    readyToSpeak: recording && status === 'recording',
    displayStatus: preparing ? 'getting ready' : recording ? 'recording' : status,
    level,
    status,
    lastMessage,
    liveTranscript,
    speechSupported,
    startRecording,
    stopRecording,
    sendInterim,
    requestRetry,
    setExpectedText,
  };
}
