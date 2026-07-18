import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAppStore } from '../store';
import { useAudioSession } from '../hooks/useAudioSession';
import { usePronunciationCoach } from '../hooks/usePronunciationCoach';
import GraphemeText from '../components/GraphemeText';
import MrsOwl from '../components/MrsOwl';
import { extractWords, splitSentences } from '@shared/phonicsEngine.js';

export default function Reading() {
  const navigate = useNavigate();
  const child = useAppStore((s) => s.child);
  const story = useAppStore((s) => s.story);
  const session = useAppStore((s) => s.session);
  const setChild = useAppStore((s) => s.setChild);
  const setLastRewards = useAppStore((s) => s.setLastRewards);
  const setFeedback = useAppStore((s) => s.setFeedback);

  const [owl, setOwl] = useState(
    'Tap a coloured letter, a word, or a sentence — Mrs Owl will show you how to say it!',
  );
  const [assessment, setAssessment] = useState(null);
  const [manualTranscript, setManualTranscript] = useState('');
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const [selectedSentence, setSelectedSentence] = useState(-1);

  const coach = usePronunciationCoach();

  const sentences = useMemo(
    () => (story ? splitSentences(story.text, story.phase) : []),
    [story],
  );

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
        const res = await api.coach({
          childId: child.id,
          context: story?.title,
          issue: msg.passed ? null : 'jaccard_below_threshold',
          speak: true,
        });
        setOwl(res.message);
        if (res.audio?.url) new Audio(res.audio.url).play().catch(() => {});
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

  const hearPhoneme = (payload) => {
    setSelectedSentence(-1);
    setOwl(`Listen carefully to /${payload.ipa}/…`);
    coach.pronounce({
      type: 'phoneme',
      ipa: payload.ipa,
      grapheme: payload.grapheme,
      phase: story.phase,
      wordIndex: payload.wordIndex,
    });
  };

  const hearWord = (payload) => {
    setSelectedSentence(-1);
    setOwl(`Let's sound out "${payload.word}" together…`);
    coach.pronounce({
      type: 'word',
      value: payload.word,
      phase: story.phase,
      wordIndex: payload.wordIndex,
    });
  };

  const hearSentence = (sentence) => {
    setSelectedSentence(sentence.index);
    setOwl('Follow the glowing words as I read this sentence…');
    coach.pronounce({
      type: 'sentence',
      text: sentence.text,
      phase: story.phase,
      sentenceIndex: sentence.index,
      wordIndexes: sentence.wordIndexes,
      wordIndex: sentence.startWordIndex,
    });
  };

  const hearStory = () => {
    setSelectedSentence(-1);
    setOwl('Follow along — I will read the whole story for you…');
    const allIndexes = sentences.flatMap((s) => s.wordIndexes);
    coach.pronounce({
      type: 'story',
      text: story.text,
      phase: story.phase,
      wordIndexes: allIndexes,
      wordIndex: 0,
    });
  };

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

  const owlMessage = coach.message || owl || audio.lastMessage;
  const activeSentenceWords =
    selectedSentence >= 0 ? sentences[selectedSentence]?.wordIndexes : null;

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

        <div className="listen-toolbar">
          <p className="listen-hint">
            <strong>Learn with Mrs Owl:</strong> tap a <em>coloured letter</em> to hear the
            pure phonics sound (sss, not the letter name), tap a <em>word</em> to sound it out,
            or play a sentence below.
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn secondary"
              onClick={hearStory}
              disabled={coach.speaking}
            >
              Hear whole story
            </button>
            {coach.speaking && (
              <button type="button" className="btn ghost" onClick={coach.stop}>
                Stop Mrs Owl
              </button>
            )}
          </div>
          <div className="sentence-list" aria-label="Sentences">
            {sentences.map((s) => (
              <button
                key={s.index}
                type="button"
                className={`sentence-chip ${selectedSentence === s.index ? 'on' : ''} ${
                  coach.active.sentenceIndex === s.index ? 'playing' : ''
                }`}
                onClick={() => hearSentence(s)}
                disabled={coach.speaking && coach.active.sentenceIndex !== s.index}
                title="Hear this sentence"
              >
                <span className="sentence-num">{s.index + 1}</span>
                <span className="sentence-preview">{s.text}</span>
              </button>
            ))}
          </div>
        </div>

        <GraphemeText
          text={story.text}
          phase={story.phase}
          highlight={story.highlight}
          activeWordIndex={coach.active.wordIndex}
          activeTileIndex={coach.active.tileIndex}
          activeSentenceWordIndexes={activeSentenceWords}
          onPhonemeClick={hearPhoneme}
          onWordClick={hearWord}
        />

        {coach.lesson?.display && (
          <div className="pronounce-panel" aria-live="polite">
            {coach.lesson.type === 'phoneme' && (
              <>
                <span
                  className="pronounce-tile"
                  style={{ background: coach.lesson.display.color }}
                >
                  {coach.lesson.display.grapheme}
                </span>
                <div>
                  <strong>
                    Sound: /{coach.lesson.display.ipa}/
                    {coach.speaking ? ' · playing pure phonics…' : ''}
                  </strong>
                  <p>{coach.lesson.display.cue}</p>
                  <small>{coach.lesson.display.tipSpeak || coach.lesson.display.example}</small>
                </div>
              </>
            )}
            {coach.lesson.type === 'word' && (
              <div>
                <strong>Sounding out: {coach.lesson.display.word}</strong>
                <p className="ipa-inline">
                  {(coach.lesson.display.phonemes || []).map((p) => `/${p}/`).join(' · ')}
                </p>
              </div>
            )}
            {(coach.lesson.type === 'sentence' || coach.lesson.type === 'story') && (
              <div>
                <strong>Follow the glowing words</strong>
                <p className="ipa-inline">{coach.lesson.display.text}</p>
              </div>
            )}
          </div>
        )}

        <div className="ipa-strip" aria-label="IPA phoneme strip — click to hear">
          {(story.highlight || [])
            .filter((p) => p.type === 'word')
            .flatMap((p, wi) =>
              (p.tiles || [])
                .filter((t) => t.grapheme)
                .map((t, ti) => ({ ...t, word: p.value, wordIndex: wi, tileIndex: ti })),
            )
            .slice(0, 32)
            .map((t, i) => (
              <button
                key={`${t.ipa}-${i}`}
                type="button"
                className="ipa-chip clickable"
                onClick={() =>
                  hearPhoneme({
                    ipa: t.ipa,
                    grapheme: t.grapheme,
                    wordIndex: t.wordIndex,
                    tileIndex: t.tileIndex,
                  })
                }
              >
                {t.grapheme} /{t.ipa}/
              </button>
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

      <MrsOwl message={owlMessage} speaking={coach.speaking || audio.recording} />
    </section>
  );
}

function levelPct(level) {
  return Math.round(Math.min(1, level * 4) * 100);
}
