import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAppStore } from '../store';
import { useAudioSession } from '../hooks/useAudioSession';
import GraphemeText from '../components/GraphemeText';
import MrsOwl from '../components/MrsOwl';
import { extractWords } from '@shared/phonicsEngine.js';

export default function Reading() {
  const navigate = useNavigate();
  const child = useAppStore((s) => s.child);
  const story = useAppStore((s) => s.story);
  const session = useAppStore((s) => s.session);
  const setChild = useAppStore((s) => s.setChild);
  const setLastRewards = useAppStore((s) => s.setLastRewards);
  const setFeedback = useAppStore((s) => s.setFeedback);

  const [owl, setOwl] = useState('Read the story aloud. I am listening carefully!');
  const [assessment, setAssessment] = useState(null);
  const [manualTranscript, setManualTranscript] = useState('');
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');

  const onAssessment = useCallback((msg) => {
    setAssessment(msg);
    if (msg.encourage) setOwl(msg.encourage);
  }, []);

  const onFinal = useCallback(
    async (msg) => {
      setAssessment(msg);
      setOwl(msg.message || owl);
      setFeedback(msg);
      try {
        const coach = await api.coach({
          childId: child.id,
          context: story?.title,
          issue: msg.passed ? null : 'jaccard_below_threshold',
          speak: true,
        });
        setOwl(coach.message);
        if (coach.audio?.url) new Audio(coach.audio.url).play().catch(() => {});
      } catch {
        /* ignore */
      }
    },
    [child?.id, story?.title, owl, setFeedback],
  );

  const onQuality = useCallback((msg) => {
    if (msg.advice) setOwl(msg.advice);
  }, []);

  const audio = useAudioSession({
    sessionId: session?.id,
    onAssessment,
    onFinal,
    onQuality,
  });

  const expectedPreview = useMemo(
    () => (story ? extractWords(story.text).slice(0, 8).join(' ') : ''),
    [story],
  );

  if (!child || !story || !session) {
    return (
      <p>
        No active session. <Link to="/home">Go home</Link>
      </p>
    );
  }

  const finish = async (force = false) => {
    setCompleting(true);
    setError('');
    const transcript =
      manualTranscript.trim() ||
      assessment?.transcript ||
      (force ? story.text : expectedPreview);
    try {
      // Send interim for Jaccard path if user typed/simulated
      audio.sendInterim(transcript);
      const result = await api.completeSession(session.id, { transcript, force });
      setLastRewards(result.rewards);
      if (result.rewards?.child) setChild(result.rewards.child);
      navigate('/rewards');
    } catch (err) {
      if (err.status === 422) {
        setError(err.data?.message || 'Try reading again');
        setOwl(err.data?.message || 'Shall we try that page again?');
        audio.requestRetry();
      } else {
        setError(err.message || 'Could not complete');
      }
    } finally {
      setCompleting(false);
    }
  };

  return (
    <section className="reading">
      <div className="reading-main">
        <header className="story-head">
          <div>
            <p className="eyebrow">Phase {story.phase} · {story.theme}</p>
            <h1>{story.title}</h1>
          </div>
          {story.illustrationUrl && (
            <img
              className="story-art"
              src={story.illustrationUrl}
              alt=""
              width={160}
              height={160}
            />
          )}
        </header>

        <GraphemeText text={story.text} phase={story.phase} highlight={story.highlight} />

        <div className="ipa-strip" aria-label="IPA phoneme strip">
          {(story.highlight || [])
            .filter((p) => p.type === 'word')
            .flatMap((p) => p.phonemes || [])
            .slice(0, 24)
            .map((ipa, i) => (
              <span key={`${ipa}-${i}`} className="ipa-chip">
                /{ipa}/
              </span>
            ))}
        </div>

        <div className="mic-panel">
          <div className="level-meter" aria-hidden="true">
            <div className="level-fill" style={{ width: `${Math.min(100, levelPct(audio.level))}%` }} />
          </div>
          <p className="status-line">
            Mic: {audio.status}
            {audio.connected ? '' : ' (connecting…)'}
          </p>
          <div className="btn-row">
            {!audio.recording ? (
              <button className="btn primary" onClick={() => audio.startRecording()}>
                Start reading aloud
              </button>
            ) : (
              <button
                className="btn danger"
                onClick={() => audio.stopRecording(manualTranscript)}
              >
                Stop & assess
              </button>
            )}
            <a className="btn ghost" href={api.pdfUrl(story.id)} target="_blank" rel="noreferrer">
              Download PDF
            </a>
          </div>

          <label className="sim-label">
            Practice / fallback transcript (for demo without clear mic)
            <textarea
              rows={3}
              value={manualTranscript}
              onChange={(e) => {
                setManualTranscript(e.target.value);
                audio.sendInterim(e.target.value);
              }}
              placeholder={story.text}
            />
          </label>

          <div className="btn-row">
            <button className="btn secondary" onClick={() => finish(false)} disabled={completing}>
              {completing ? 'Checking…' : 'Finish & collect acorns'}
            </button>
            <button className="btn ghost" onClick={() => finish(true)} disabled={completing}>
              Complete anyway (demo)
            </button>
          </div>
          {error && <p className="error">{error}</p>}
          {assessment?.validation && (
            <p className="score">
              Jaccard words {(assessment.validation.jaccardWords * 100).toFixed(0)}% · phonemes{' '}
              {(assessment.validation.jaccardPhonemes * 100).toFixed(0)}% · combined{' '}
              {(assessment.validation.combined * 100).toFixed(0)}%
            </p>
          )}
        </div>
      </div>

      <MrsOwl message={owl || audio.lastMessage} speaking={audio.recording} />
    </section>
  );
}

function levelPct(level) {
  return Math.round(Math.min(1, level * 4) * 100);
}
