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
      const passed = Boolean(msg.passed ?? msg.validation?.passed);
      const normalized = { ...msg, passed };
      setAssessment(normalized);
      if (msg.transcript) setManualTranscript(msg.transcript);
      setFeedback(normalized);
      const pct =
        msg.validation?.displayScore ??
        Math.round((msg.validation?.combined || 0) * 100);
      const heard = msg.message
        || (msg.transcript
          ? `${passed ? 'Nice reading!' : 'Not quite yet.'} I heard: “${msg.transcript}” (~${pct}%).`
          : 'I could not hear clear words — please try again.');
      setOwl(heard);
      try {
        const res = await api.coach({
          childId: child.id,
          // Never send Whisper text as the line to practise — only the real target
          targetSentence: expectedForAssess,
          context: `score ${pct}% · coverage ${Math.round((msg.validation?.coverage || 0) * 100)}% · scorer ${msg.validation?.scorer || 'unknown'}`,
          issue: passed ? 'pass' : msg.validation?.reason || 'below_threshold',
          speak: true,
        });
        setOwl(`${heard} ${res.message}`);
        if (res.audio?.url) new Audio(res.audio.url).play().catch(() => {});
      } catch {
        /* ignore */
      }
    },
    [child?.id, story?.title, expectedForAssess, setFeedback],
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

  /**
   * Story / page hear: phonemes → word → each sentence (last), by default.
   * @param {'phonemes'|'words'|'full'} [hearMode]
   */
  const hearStory = (hearMode = 'phonemes') => {
    setSelectedSentence(-1);
    const tips = {
      phonemes: 'Phonemes first, then each word, then each sentence…',
      words: 'Each word, then each sentence…',
      full: 'Follow along — I will read the whole page…',
    };
    setOwl(tips[hearMode] || tips.phonemes);
    const allIndexes = sentences.flatMap((s) => s.wordIndexes);
    coach.pronounce({
      type: 'story',
      text: story.text,
      phase: story.phase,
      wordIndexes: allIndexes,
      wordIndex: 0,
      hearMode,
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
    // Only the Whisper (or explicit typed demo) transcript — never the expected sentence
    const transcript = String(assessment?.transcript || manualTranscript || '').trim();
    if (!force && !transcript) {
      setError('Read aloud first: Start → speak the sentence → Stop & assess.');
      setOwl('I need to hear you read before we collect acorns.');
      setCompleting(false);
      return;
    }
    if (!force && assessment && assessment.passed === false) {
      setError('That reading did not match closely enough yet. Try Stop & assess again.');
      setOwl(assessment.message || 'Shall we try that sentence again?');
      setCompleting(false);
      return;
    }
    try {
      const result = await api.completeSession(session.id, {
        transcript: force && !transcript ? '(demo complete)' : transcript,
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
            <strong>Hear order:</strong> each word’s phonemes play from the{' '}
            <em>44 cached sounds</em> first, then the blended word, then the full sentence.
          </p>
          <div className="btn-row">
            <div className="hear-mode-row" role="group" aria-label="Hear whole page">
              <button
                type="button"
                className="btn primary"
                onClick={() => hearStory('phonemes')}
                disabled={coach.speaking}
                title="Phonemes, then words, then each sentence"
              >
                Hear story (sounds → words → sentences)
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => hearStory('words')}
                disabled={coach.speaking}
              >
                Words → sentences
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => hearStory('full')}
                disabled={coach.speaking}
              >
                Full page only
              </button>
            </div>
            {activeSentence && (
              <div className="hear-mode-row" role="group" aria-label="Hear selected sentence">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => hearSentence(activeSentence, 'phonemes')}
                  disabled={coach.speaking}
                  title="Phonemes, then each word, then this sentence"
                >
                  Hear line (sounds → word → sentence)
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => hearSentence(activeSentence, 'words')}
                  disabled={coach.speaking}
                >
                  Words → sentence
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => hearSentence(activeSentence, 'full')}
                  disabled={coach.speaking}
                >
                  Sentence only
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
                    className="btn secondary sentence-hear"
                    onClick={() => hearSentence(s, 'phonemes')}
                    disabled={coach.speaking}
                    title="Phonemes → word → sentence"
                  >
                    Hear
                  </button>
                  <button
                    type="button"
                    className="btn ghost sentence-hear"
                    onClick={() => hearSentence(s, 'words')}
                    disabled={coach.speaking}
                    title="Words → sentence"
                  >
                    Words
                  </button>
                  <button
                    type="button"
                    className="btn ghost sentence-hear"
                    onClick={() => hearSentence(s, 'full')}
                    disabled={coach.speaking}
                    title="Full sentence only"
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
                    ? 'Order: phonemes → word → sentence'
                    : coach.lesson.hearMode === 'words'
                      ? 'Order: word → sentence'
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
          <p className="listen-hint">
            <strong>Real scoring:</strong> Start → read the sentence aloud → Stop &amp; assess. Your
            voice is sent to the server, transcribed, and compared to the words/phonemes. Empty or
            random speech will not pass.
          </p>
          <div className="level-meter" aria-hidden="true">
            <div className="level-fill" style={{ width: `${Math.min(100, levelPct(audio.level))}%` }} />
          </div>
          <p className="status-line">
            Mic: {audio.status}
            {audio.connected ? '' : ' (connecting…)'}
            {assessment?.path ? ` · path: ${assessment.path}` : ''}
          </p>
          <div className="btn-row">
            {!audio.recording ? (
              <button
                className="btn primary"
                onClick={() => {
                  // Always score a single selected sentence (not the whole page)
                  if (selectedSentence < 0 && sentences.length) {
                    setSelectedSentence(0);
                    audio.setExpectedText(sentences[0].text);
                  } else {
                    audio.setExpectedText(expectedForAssess);
                  }
                  setAssessment(null);
                  setError('');
                  audio.startRecording();
                }}
              >
                Start reading aloud
              </button>
            ) : (
              <button
                className="btn danger"
                onClick={() =>
                  audio.stopRecording({
                    typedTranscript: '',
                    allowTypedFallback: false,
                    expectedText: expectedForAssess,
                  })
                }
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

          {assessment?.transcript != null && (
            <div className="heard-line">
              <p>
                <strong>Target:</strong> {expectedForAssess}
              </p>
              {assessment.whisperTranscript &&
                assessment.whisperTranscript !== assessment.transcript && (
                  <p>
                    <strong>Whisper raw:</strong> {assessment.whisperTranscript}
                  </p>
                )}
              <p>
                <strong>Heard:</strong> {assessment.transcript || '(no words recognised)'}
              </p>
              {assessment.validation?.targetText &&
                assessment.validation.targetText !== expectedForAssess && (
                  <p>
                    <strong>Scored against:</strong> {assessment.validation.targetText}
                  </p>
                )}
              {assessment.validation?.scorer && (
                <p className="scorer-tag">Scorer: {assessment.validation.scorer}</p>
              )}
            </div>
          )}

          <details className="demo-transcript">
            <summary>Demo only — typed transcript fallback</summary>
            <label className="sim-label">
              Use only if the mic/ASR is unavailable. This is not a real pronunciation score.
              <textarea
                rows={2}
                value={manualTranscript}
                onChange={(e) => setManualTranscript(e.target.value)}
                placeholder="Type what the child said…"
              />
            </label>
            <button
              type="button"
              className="btn ghost"
              onClick={() =>
                audio.stopRecording({
                  typedTranscript: manualTranscript,
                  allowTypedFallback: true,
                })
              }
              disabled={!manualTranscript.trim() || audio.recording}
            >
              Score typed demo transcript
            </button>
          </details>

          <div className="btn-row">
            <button
              className="btn secondary"
              onClick={() => finish(false)}
              disabled={completing || !assessment?.passed}
              title={
                assessment?.passed
                  ? 'Collect acorns for a passing reading'
                  : 'Pass Stop & assess first'
              }
            >
              {completing ? 'Checking…' : 'Finish & collect acorns'}
            </button>
            <button className="btn ghost" onClick={() => finish(true)} disabled={completing}>
              Complete anyway (demo)
            </button>
          </div>
          {error && <p className="error">{error}</p>}
          {assessment?.validation && (
            <div className={`score-panel ${assessment.passed ? 'score-pass' : 'score-fail'}`}>
              <p className="score">
                Overall{' '}
                {assessment.validation.displayScore ??
                  Math.round((assessment.validation.combined || 0) * 100)}
                %
                {assessment.passed ? ' · PASS' : ' · TRY AGAIN'}
                {assessment.validation.scorer ? ` · ${assessment.validation.scorer}` : ''}
              </p>
              {Array.isArray(assessment.validation.wordScores) &&
                assessment.validation.wordScores.length > 0 && (
                  <ul className="word-score-list" aria-label="Per-word phonics scores">
                    {assessment.validation.wordScores.map((w, i) => (
                      <li key={`${w.expected}-${i}`} className={`word-score word-score-${w.status}`}>
                        <span className="word-score-head">
                          <strong>{w.expected}</strong>
                          <span className="word-score-pct">{Math.round((w.score || 0) * 100)}%</span>
                          <span className="word-score-label">{w.label}</span>
                        </span>
                        <span className="word-score-ipa">
                          {w.expectedPhonemes?.length
                            ? `/${w.expectedPhonemes.join('/ /')}/`
                            : ''}
                          {w.heard && w.heard !== w.expected ? ` · heard “${w.heard}”` : ''}
                        </span>
                        {w.tip && <span className="word-score-tip">{w.tip}</span>}
                      </li>
                    ))}
                  </ul>
                )}
            </div>
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
