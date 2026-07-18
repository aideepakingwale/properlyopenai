import { useCallback, useEffect, useMemo, useState } from 'react';
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

  const isPractice = story?.kind === 'practice' || story?.metadata?.kind === 'practice';

  const [owl, setOwl] = useState(
    isPractice
      ? 'Pick a sentence below. Hear it, then read it aloud so we can score you.'
      : 'Tap a coloured letter, a word, or a sentence — Mrs Owl will show you how to say it!',
  );
  const [assessment, setAssessment] = useState(null);
  const [manualTranscript, setManualTranscript] = useState('');
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const [selectedSentence, setSelectedSentence] = useState(isPractice ? 0 : -1);

  const coach = usePronunciationCoach();

  const sentences = useMemo(() => {
    if (!story) return [];
    const fromMeta = story.metadata?.sentences || story.sentences;
    if (Array.isArray(fromMeta) && fromMeta.length) {
      // Rebuild indexes so highlighting / assessment stay aligned
      const joined = fromMeta.join(' ');
      const split = splitSentences(joined, story.phase);
      if (split.length) return split;
      return fromMeta.map((text, index) => ({
        index,
        text,
        words: extractWords(text),
        wordIndexes: [],
        startWordIndex: 0,
      }));
    }
    return splitSentences(story.text, story.phase);
  }, [story]);

  const activeSentence = selectedSentence >= 0 ? sentences[selectedSentence] : null;
  const expectedForAssess = activeSentence?.text || story?.text || '';

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

  // Keep live assessment focused on the selected sentence
  useEffect(() => {
    if (!audio.setExpectedText) return;
    audio.setExpectedText(expectedForAssess);
  }, [expectedForAssess, audio.setExpectedText]);

  useEffect(() => {
    if (isPractice && selectedSentence < 0 && sentences.length) {
      setSelectedSentence(0);
    }
  }, [isPractice, sentences.length, selectedSentence]);

  const hearPhoneme = (payload) => {
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
    setOwl(`Let's sound out "${payload.word}" together…`);
    coach.pronounce({
      type: 'word',
      value: payload.word,
      phase: story.phase,
      wordIndex: payload.wordIndex,
    });
  };

  const selectSentence = (sentence) => {
    setSelectedSentence(sentence.index);
    setManualTranscript('');
    setAssessment(null);
    setOwl(`Sentence ${sentence.index + 1} ready — hear sounds, words, or the line, then read aloud.`);
  };

  /**
   * @param {object} sentence
   * @param {'phonemes'|'words'|'full'} hearMode
   */
  const hearSentence = (sentence, hearMode = 'phonemes') => {
    setSelectedSentence(sentence.index);
    setManualTranscript('');
    setAssessment(null);
    const words = extractWords(sentence.text);
    const localIndexes = words.map((_, i) => i);
    const tips = {
      phonemes: 'Listen to each phoneme, then each word, then the whole sentence…',
      words: 'Listen to each word, then the whole sentence…',
      full: 'Follow the glowing words as I read this sentence…',
    };
    setOwl(tips[hearMode] || tips.phonemes);
    coach.pronounce({
      type: 'sentence',
      text: sentence.text,
      phase: story.phase,
      sentenceIndex: sentence.index,
      wordIndexes: localIndexes,
      wordIndex: 0,
      hearMode,
    });
  };

  const hearStory = () => {
    setSelectedSentence(-1);
    setOwl('Follow along — I will read the whole page for you…');
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
      <section className="reading empty-session">
        <h1>No active reading session</h1>
        <p>
          Start <strong>Practice sentences</strong> or a new story from Home so we have lines to
          read and score.
        </p>
        <Link className="btn primary" to="/home">
          Go home
        </Link>
      </section>
    );
  }

  if (!sentences.length) {
    return (
      <section className="reading empty-session">
        <h1>{story.title}</h1>
        <p>This page has no sentences to read. Start a practice pack from Home.</p>
        <Link className="btn primary" to="/home">
          Practice sentences
        </Link>
      </section>
    );
  }

  const finish = async (force = false) => {
    setCompleting(true);
    setError('');
    const transcript =
      manualTranscript.trim() ||
      assessment?.transcript ||
      (force ? expectedForAssess : expectedForAssess);
    try {
      audio.sendInterim(transcript);
      const result = await api.completeSession(session.id, {
        transcript,
        force,
        expectedText: expectedForAssess,
      });
      setLastRewards(result.rewards);
      if (result.rewards?.child) setChild(result.rewards.child);
      navigate('/rewards');
    } catch (err) {
      if (err.status === 422) {
        setError(err.data?.message || 'Try reading again');
        setOwl(err.data?.message || 'Shall we try that sentence again?');
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
  const displayText = activeSentence?.text || story.text;

  return (
    <section className="reading">
      <div className="reading-main">
        <header className="story-head">
          <div>
            <p className="eyebrow">
              Phase {story.phase} · {isPractice ? 'Sentence practice' : story.theme}
            </p>
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
            <strong>{isPractice ? 'Read & evaluate:' : 'Learn with Mrs Owl:'}</strong>{' '}
            {isPractice
              ? 'select a sentence, use Sounds / Words / Line to hear it, then Start reading aloud.'
              : 'tap a letter or word, or use Sounds / Words / Line on a sentence below.'}
          </p>
          <div className="btn-row">
            {!isPractice && (
              <button
                type="button"
                className="btn secondary"
                onClick={hearStory}
                disabled={coach.speaking}
              >
                Hear whole story
              </button>
            )}
            {activeSentence && (
              <div className="hear-mode-row" role="group" aria-label="Hear selected sentence">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => hearSentence(activeSentence, 'phonemes')}
                  disabled={coach.speaking}
                  title="Sound out every phoneme, then blend"
                >
                  Hear sounds
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => hearSentence(activeSentence, 'words')}
                  disabled={coach.speaking}
                >
                  Hear words
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => hearSentence(activeSentence, 'full')}
                  disabled={coach.speaking}
                >
                  Hear sentence
                </button>
              </div>
            )}
            {coach.speaking && (
              <button type="button" className="btn ghost" onClick={coach.stop}>
                Stop Mrs Owl
              </button>
            )}
          </div>
          <div className="sentence-list" aria-label="Sentences to read">
            {sentences.map((s) => (
              <div key={s.index} className="sentence-row">
                <button
                  type="button"
                  className={`sentence-chip ${selectedSentence === s.index ? 'on' : ''} ${
                    coach.active.sentenceIndex === s.index ? 'playing' : ''
                  }`}
                  onClick={() => selectSentence(s)}
                  title="Select this sentence to read and evaluate"
                >
                  <span className="sentence-num">{s.index + 1}</span>
                  <span className="sentence-preview">{s.text}</span>
                </button>
                <div className="sentence-hear-group">
                  <button
                    type="button"
                    className="btn ghost sentence-hear"
                    onClick={() => hearSentence(s, 'phonemes')}
                    disabled={coach.speaking}
                    title="Hear phonemes for this sentence"
                  >
                    Sounds
                  </button>
                  <button
                    type="button"
                    className="btn ghost sentence-hear"
                    onClick={() => hearSentence(s, 'words')}
                    disabled={coach.speaking}
                    title="Hear each word"
                  >
                    Words
                  </button>
                  <button
                    type="button"
                    className="btn ghost sentence-hear"
                    onClick={() => hearSentence(s, 'full')}
                    disabled={coach.speaking}
                    title="Hear the full sentence"
                  >
                    Line
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <GraphemeText
          text={displayText}
          phase={story.phase}
          highlight={
            activeSentence
              ? undefined
              : story.highlight
          }
          activeWordIndex={coach.active.wordIndex}
          activeTileIndex={coach.active.tileIndex}
          activeSentenceWordIndexes={activeSentence ? null : activeSentenceWords}
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
                <strong>
                  {coach.lesson.hearMode === 'phonemes'
                    ? 'Sounding out phonemes…'
                    : coach.lesson.hearMode === 'words'
                      ? 'Hearing each word…'
                      : 'Follow the glowing words'}
                </strong>
                <p className="ipa-inline">{coach.lesson.display.text}</p>
                {coach.lesson.hearMode === 'phonemes' &&
                  Array.isArray(coach.lesson.display.phonemesByWord) && (
                    <p className="ipa-inline">
                      {coach.lesson.display.phonemesByWord
                        .map((ps) => ps.map((p) => `/${p}/`).join(''))
                        .join(' · ')}
                    </p>
                  )}
              </div>
            )}
          </div>
        )}

        <div className="mic-panel">
          <p className="assess-target">
            Scoring against:{' '}
            <strong>{activeSentence ? `Sentence ${activeSentence.index + 1}` : 'whole page'}</strong>
            <span className="assess-quote"> “{expectedForAssess}”</span>
          </p>
          <div className="level-meter" aria-hidden="true">
            <div className="level-fill" style={{ width: `${Math.min(100, levelPct(audio.level))}%` }} />
          </div>
          <p className="status-line">
            Mic: {audio.status}
            {audio.connected ? '' : ' (connecting…)'}
          </p>
          <div className="btn-row">
            {!audio.recording ? (
              <button
                className="btn primary"
                onClick={() => {
                  if (selectedSentence < 0 && sentences.length) {
                    setSelectedSentence(0);
                  }
                  audio.startRecording();
                }}
              >
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
            {story.id && (
              <a className="btn ghost" href={api.pdfUrl(story.id)} target="_blank" rel="noreferrer">
                Download PDF
              </a>
            )}
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
              placeholder={expectedForAssess}
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
