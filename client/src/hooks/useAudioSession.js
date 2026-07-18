import { useCallback, useEffect, useRef, useState } from 'react';
import { wsAudioUrl } from '../api';

/**
 * Browser mic capture + WebSocket streaming with quality checks and reconnect.
 */
export function useAudioSession({ sessionId, onAssessment, onFinal, onQuality }) {
  const wsRef = useRef(null);
  const mediaRef = useRef(null);
  const recorderRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [status, setStatus] = useState('idle');
  const [lastMessage, setLastMessage] = useState('');

  const cleanupLoop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return;
    const ws = new WebSocket(wsAudioUrl());
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setStatus('connected');
      if (sessionId) {
        ws.send(JSON.stringify({ type: 'start', sessionId }));
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setStatus('reconnecting');
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
        if (msg.type === 'final_assessment') onFinal?.(msg);
        if (msg.type === 'quality_ack') onQuality?.(msg);
        if (msg.message) setLastMessage(msg.message);
        if (msg.type === 'degraded') setStatus('degraded');
        if (msg.type === 'recovered') setStatus('connected');
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
      recorderRef.current?.stop();
      mediaRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [connect]);

  useEffect(() => {
    if (connected && sessionId && wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'start', sessionId }));
    }
  }, [connected, sessionId]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    mediaRef.current = stream;

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
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorderRef.current = recorder;

    recorder.ondataavailable = async (e) => {
      if (e.data.size && wsRef.current?.readyState === 1) {
        const buf = await e.data.arrayBuffer();
        wsRef.current.send(buf);
      }
    };

    recorder.start(250);
    setRecording(true);
    setStatus('recording');
  };

  const stopRecording = (transcript = '') => {
    cleanupLoop();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    mediaRef.current?.getTracks().forEach((t) => t.stop());
    setRecording(false);
    setStatus('processing');
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(
        JSON.stringify({
          type: 'end',
          mime: 'audio/webm',
          transcript,
        }),
      );
    }
  };

  const sendInterim = (transcript) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'interim', transcript }));
    }
  };

  const requestRetry = () => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'retry' }));
    }
    setStatus('connected');
  };

  return {
    connected,
    recording,
    level,
    status,
    lastMessage,
    startRecording,
    stopRecording,
    sendInterim,
    requestRetry,
  };
}
