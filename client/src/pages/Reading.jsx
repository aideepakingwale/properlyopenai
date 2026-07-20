import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAppStore } from '../store';
import { useAudioSession } from '../hooks/useAudioSession';
import { usePronunciationCoach } from '../hooks/usePronunciationCoach';
import GraphemeText from '../components/GraphemeText';
import MrsOwl from '../components/MrsOwl';
import MouthCue from '../components/MouthCue';
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
  const [liveAssessment, setLiveAssessment] = useState(null);
  const [manualTranscript, setManualTranscript] = useState('');
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const [selectedSentence, setSelectedSentence] = useState(0);
  const [sentenceResults, setSentenceResults] = useState({});
  const [autoStopping, setAutoStopping] = useState(false);
  const autoStopRef = useRef(false);
  const stopRecordingRef = useRef(null);
  const sentenceResultsRef = useRef({});
  const recordingSentenceIndexRef = useRef(null);
  const recordingExpectedTextRef = useRef('');

  const coach = usePronunciationCoach();

  const markReadingActivity = useCallback(
    (type) => {
      if (!child?.id) return;
      api.recordActivity(child.id, { type })
        .then((result) => {
          if (result.child) setChild(result.child);
        })
        .catch(() => {});
    },
    [child?.id, setChild],
  );

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

  useEffect(() => {
    const next = {};
    sentenceResultsRef.current = next;
    setSentenceResults(next);
    setAssessment(null);
    setLiveAssessment(null);
    setManualTranscript('');
    setSelectedSentence(sentences.length ? 0 : -1);
  }, [session?.id, story?.id, sentences.length]);

  useEffect(() => {
    if (child?.id && story?.id && session?.id) {
      markReadingActivity('read_page_open');
    }
  }, [child?.id, story?.id, session?.id, markReadingActivity]);

  const onAssessment = useCallback((msg) => {
    setLiveAssessment(msg);
    if (msg.encourage) setOwl(msg.encourage);
  }, []);

  const onFinal = useCallback(
    async (msg) => {
      const passed = Boolean(msg.passed ?? msg.validation?.passed);
      const audioVerified = isRewardEligibleAssessment(msg);
      const sentenceComplete = passed && audioVerified;
      const normalized = { ...msg, passed, audioVerified, sentenceComplete };
      const attemptedIndex =
        typeof recordingSentenceIndexRef.current === 'number'
          ? recordingSentenceIndexRef.current
          : selectedSentence;
      const attemptedSentence = sentences.find((s) => s.index === attemptedIndex) || activeSentence;
      setLiveAssessment(null);
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

      let progressNote = '';
      if (attemptedSentence) {
        const resultRecord = {
          passed: sentenceComplete,
          scoredPassed: passed,
          audioVerified,
          score: pct,
          transcript: msg.transcript || '',
          validation: msg.validation,
          message: msg.message || '',
          updatedAt: new Date().toISOString(),
        };
        const nextResults = {
          ...sentenceResultsRef.current,
          [attemptedSentence.index]: resultRecord,
        };
        sentenceResultsRef.current = nextResults;
        setSentenceResults(nextResults);

        if (sentenceComplete) {
          const nextSentence = findNextIncompleteSentence(
            sentences,
            nextResults,
            attemptedSentence.index,
          );
          if (nextSentence) {
            setSelectedSentence(nextSentence.index);
            progressNote = `Sentence ${attemptedSentence.index + 1} complete. Next is sentence ${nextSentence.index + 1}.`;
          } else {
            progressNote = 'All sentences are complete. You can collect acorns now.';
          }
        } else if (passed && !audioVerified) {
          progressNote = `Sentence ${attemptedSentence.index + 1} was only a demo score. Use the microphone to unlock rewards.`;
        } else {
          progressNote = `Sentence ${attemptedSentence.index + 1} still needs another try.`;
        }
      }

      setOwl(progressNote ? `${heard} ${progressNote}` : heard);
      try {
        const res = await api.coach({
          childId: child.id,
          // Never send Whisper text as the line to practise — only the real target
          targetSentence: attemptedSentence?.text || expectedForAssess,
          context: `score ${pct}% · coverage ${Math.round((msg.validation?.coverage || 0) * 100)}% · scorer ${msg.validation?.scorer || 'unknown'}`,
          issue: passed ? 'pass' : msg.validation?.reason || 'below_threshold',
          speak: true,
        });
        setOwl(`${heard} ${res.message}${progressNote ? ` ${progressNote}` : ''}`);
        if (res.audio?.url) new Audio(res.audio.url).play().catch(() => {});
      } catch {
        /* ignore */
      }
    },
    [activeSentence, child?.id, expectedForAssess, selectedSentence, sentences, setFeedback],
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

  useEffect(() => {
    stopRecordingRef.current = audio.stopRecording;
  }, [audio.stopRecording]);

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

  useEffect(() => {
    if (!audio.recording) {
      autoStopRef.current = false;
      setAutoStopping(false);
      return undefined;
    }

    const expectedWordsForStop = extractWords(expectedForAssess);
    const heardWordsForStop = extractWords(audio.liveTranscript);
    if (
      autoStopRef.current ||
      !readingLooksComplete(expectedWordsForStop, heardWordsForStop)
    ) {
      return undefined;
    }

    autoStopRef.current = true;
    setAutoStopping(true);
    setOwl('I heard the line. Checking your reading now...');
    const timer = window.setTimeout(() => {
      stopRecordingRef.current?.({
        typedTranscript: '',
        allowTypedFallback: false,
        expectedText: expectedForAssess,
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [audio.recording, audio.liveTranscript, expectedForAssess]);

  const hearPhoneme = (payload) => {
    markReadingActivity('hear_phoneme');
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
    markReadingActivity('hear_word');
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
    setLiveAssessment(null);
    setOwl(`Sentence ${sentence.index + 1} ready — hear sounds, words, or the line, then read aloud.`);
  };

  /**
   * @param {object} sentence
   * @param {'phonemes'|'words'|'full'} hearMode
   */
  const hearSentence = (sentence, hearMode = 'phonemes') => {
    markReadingActivity(`hear_sentence_${hearMode}`);
    setSelectedSentence(sentence.index);
    setManualTranscript('');
    setAssessment(null);
    setLiveAssessment(null);
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
    markReadingActivity(`hear_story_${hearMode}`);
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

  const passedSentenceCount = sentences.filter((s) => sentenceResults[s.index]?.passed).length;
  const allSentencesPassed = sentences.length > 0 && passedSentenceCount === sentences.length;
  const nextIncompleteSentence =
    sentences.find((s) => !sentenceResults[s.index]?.passed) || null;
  const completionTranscript = sentences
    .map((s) => (sentenceResults[s.index]?.passed ? sentenceResults[s.index]?.transcript || '' : ''))
    .filter(Boolean)
    .join(' ')
    .trim();

  const finish = async (force = false) => {
    setCompleting(true);
    setError('');
    if (force) {
      setError('Demo completion no longer awards rewards. Pass every sentence to collect acorns.');
      setOwl('Mrs Owl only opens the reward chest after every sentence has a passing read.');
      setCompleting(false);
      return;
    }
    if (!allSentencesPassed) {
      const next = nextIncompleteSentence || sentences[0];
      if (next) setSelectedSentence(next.index);
      const message = `Pass every sentence first (${passedSentenceCount}/${sentences.length} complete).`;
      setError(message);
      setOwl(
        next
          ? `${message} Sentence ${next.index + 1} is ready to read.`
          : 'Read aloud first, then collect acorns.',
      );
      setCompleting(false);
      return;
    }
    // Only transcripts from passed sentence assessments — never the expected sentence.
    const transcript = completionTranscript;
    if (!transcript) {
      setError('Read aloud first: Start → speak each sentence → pass every line.');
      setOwl('I need to hear every sentence before we collect acorns.');
      setCompleting(false);
      return;
    }
    try {
      const result = await api.completeSession(session.id, {
        transcript,
        force: false,
        expectedText: story.text,
        completedSentenceIndexes: sentences.map((s) => s.index),
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
  const listenSentence = activeSentence || sentences[0];
  const pictureLabel = story.illustrationMock
    ? 'Demo picture'
    : story.illustrationCached
      ? 'Reused story picture'
      : 'Fresh story picture';
  const liveWords = extractWords(audio.liveTranscript).slice(-14);
  const expectedWords = extractWords(expectedForAssess);
  const heardWords = extractWords(audio.liveTranscript);
  const liveProgress = expectedWords.length
    ? Math.min(100, Math.round((countWordsInOrder(expectedWords, heardWords) / expectedWords.length) * 100))
    : 0;
  const liveScore =
    liveAssessment?.validation?.displayScore ??
    (liveAssessment?.validation
      ? Math.round((liveAssessment.validation.combined || 0) * 100)
      : null);
  const currentScore =
    assessment?.validation?.displayScore ??
    (assessment?.validation ? Math.round((assessment.validation.combined || 0) * 100) : null);
  const scoreScope =
    assessment?.validation?.scoringScope === 'overall' ? 'whole story' : 'line';
  const sentenceScores = Array.isArray(assessment?.validation?.sentenceScores)
    ? assessment.validation.sentenceScores
    : [];

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
            <figure className="story-art-frame">
              <img
                className="story-art"
                src={story.illustrationUrl}
                alt=""
                width={180}
                height={180}
              />
              <figcaption>{pictureLabel}</figcaption>
            </figure>
          )}
        </header>

        <div className="listen-toolbar">
          <div className="listen-panel-head">
            <div>
              <p className="eyebrow">Listen and practise</p>
              <h2>{listenSentence ? `Line ${listenSentence.index + 1}` : 'Whole story'}</h2>
            </div>
            {coach.speaking && (
              <button type="button" className="btn ghost" onClick={coach.stop}>
                Stop Mrs Owl
              </button>
            )}
          </div>

          {listenSentence && <p className="listen-target-line">{listenSentence.text}</p>}

          <div className="listen-primary-actions" role="group" aria-label="Listen modes">
            <button
              type="button"
              className="listen-action-card sound"
              onClick={() => listenSentence && hearSentence(listenSentence, 'phonemes')}
              disabled={!listenSentence || coach.speaking}
              title="Hear phonemes, then words, then the full line"
            >
              <span className="listen-action-icon">/s/</span>
              <span>
                <strong>Sound it out</strong>
                <small>sounds, words, line</small>
              </span>
            </button>
            <button
              type="button"
              className="listen-action-card words"
              onClick={() => listenSentence && hearSentence(listenSentence, 'words')}
              disabled={!listenSentence || coach.speaking}
              title="Hear each word, then the full line"
            >
              <span className="listen-action-icon">Aa</span>
              <span>
                <strong>Word by word</strong>
                <small>words, line</small>
              </span>
            </button>
            <button
              type="button"
              className="listen-action-card line"
              onClick={() => listenSentence && hearSentence(listenSentence, 'full')}
              disabled={!listenSentence || coach.speaking}
              title="Hear the full line only"
            >
              <span className="listen-action-icon">▶</span>
              <span>
                <strong>Read the line</strong>
                <small>sentence only</small>
              </span>
            </button>
          </div>

          <div className="sentence-list" aria-label="Sentences to read">
            {sentences.map((s) => {
              const result = sentenceResults[s.index];
              const status = result?.passed ? 'complete' : result ? 'retry' : 'todo';
              return (
                <div
                  key={s.index}
                  className={`sentence-row ${selectedSentence === s.index ? 'active' : ''} ${status}`}
                >
                  <button
                    type="button"
                    className={`sentence-chip ${selectedSentence === s.index ? 'on' : ''} ${
                      coach.active.sentenceIndex === s.index ? 'playing' : ''
                    }`}
                    onClick={() => selectSentence(s)}
                    title={sentenceTitle(s, result)}
                  >
                    <span className="sentence-num">{s.index + 1}</span>
                    <span className="sentence-preview">{s.text}</span>
                    <span className={`sentence-status ${status}`}>
                      {result?.passed ? `✓ ${result.score}%` : result ? `Retry ${result.score}%` : 'Not read'}
                    </span>
                  </button>
                </div>
              );
            })}
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
            {(coach.active.ipa || coach.lesson.display.ipa) && (
              <MouthCue
                ipa={coach.active.ipa || coach.lesson.display.ipa}
                grapheme={coach.active.grapheme || coach.lesson.display.grapheme}
              />
            )}
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
            Read aloud:{' '}
            <strong>{activeSentence ? `Sentence ${activeSentence.index + 1}` : 'whole page'}</strong>
          </p>
          <p className="listen-hint">
            <strong>Real scoring:</strong> Start → read the sentence aloud → Stop &amp; assess. Your
            voice is sent to the server, transcribed, and compared to the words/phonemes. Empty or
            random speech will not pass.
          </p>
          <div
            className={`mic-ready-card ${
              audio.readyToSpeak ? 'ready' : audio.preparing ? 'waiting' : ''
            }`}
            aria-live="polite"
          >
            <strong>
              {audio.readyToSpeak
                ? 'Speak now'
                : audio.preparing
                  ? 'Getting the mic ready'
                  : 'Press Start, then wait for Speak now'}
            </strong>
            <span>
              {audio.readyToSpeak
                ? 'Your voice is being recorded.'
                : audio.preparing
                  ? 'Hold on for a moment before reading.'
                  : 'This keeps the first word from being missed.'}
            </span>
          </div>
          <div className="level-meter" aria-hidden="true">
            <div className="level-fill" style={{ width: `${Math.min(100, levelPct(audio.level))}%` }} />
          </div>
          <p className="status-line">
            Mic: {audio.displayStatus}
            {audio.connected ? '' : ' (connecting…)'}
            {assessment?.path ? ` · path: ${assessment.path}` : ''}
          </p>
          {audio.recording && (
            <div className="live-heard-panel" aria-live="polite">
              <div className="live-heard-head">
                <strong>Words I heard</strong>
                <span>
                  {autoStopping
                    ? 'checking'
                    : liveScore != null
                      ? `${liveScore}% live`
                      : `${liveProgress}% heard`}
                </span>
              </div>
              <div className="live-progress" aria-hidden="true">
                <span style={{ width: `${liveProgress}%` }} />
              </div>
              {liveWords.length ? (
                <div className="live-word-list">
                  {liveWords.map((word, index) => (
                    <span key={`${word}-${index}`} className="live-word">
                      {word}
                    </span>
                  ))}
                </div>
              ) : (
                <p>Listening...</p>
              )}
            </div>
          )}
          <div className="btn-row">
            {!audio.recording ? (
              <button
                className="btn primary"
                disabled={audio.preparing}
                onClick={() => {
                  const targetSentence = activeSentence || nextIncompleteSentence || sentences[0];
                  if (!targetSentence) return;
                  markReadingActivity('start_reading_aloud');
                  setSelectedSentence(targetSentence.index);
                  recordingSentenceIndexRef.current = targetSentence.index;
                  recordingExpectedTextRef.current = targetSentence.text;
                  audio.setExpectedText(targetSentence.text);
                  setAssessment(null);
                  setManualTranscript('');
                  setError('');
                  audio.startRecording();
                }}
              >
                {audio.preparing ? 'Getting mic ready...' : 'Start reading aloud'}
              </button>
            ) : (
              <button
                className="btn danger"
                disabled={autoStopping}
                onClick={() =>
                  audio.stopRecording({
                    typedTranscript: '',
                    allowTypedFallback: false,
                    expectedText: recordingExpectedTextRef.current || expectedForAssess,
                  })
                }
              >
                {autoStopping ? 'Checking...' : 'Stop & assess'}
              </button>
            )}
            {story.id && (
              <a
                className="btn ghost"
                href={api.pdfUrl(story.id)}
                target="_blank"
                rel="noreferrer"
                title="Open book in a new tab"
              >
                Open Book
              </a>
            )}
          </div>

          {assessment?.transcript != null && (
            <div className="heard-line">
              {assessment.whisperTranscript &&
                assessment.whisperTranscript !== assessment.transcript && (
                  <p>
                    <strong>Whisper raw:</strong> {assessment.whisperTranscript}
                  </p>
                )}
              <p>
                <strong>Heard:</strong> {assessment.transcript || '(no words recognised)'}
              </p>
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
              disabled={completing || !allSentencesPassed}
              title={
                allSentencesPassed
                  ? 'Collect acorns for this completed reading mission'
                  : `Pass every sentence first (${passedSentenceCount}/${sentences.length})`
              }
            >
              {completing
                ? 'Checking…'
                : allSentencesPassed
                  ? 'Finish & collect acorns'
                  : `Pass all sentences (${passedSentenceCount}/${sentences.length})`}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled
              title="Demo scores do not unlock rewards"
            >
              Demo has no rewards
            </button>
          </div>
          {error && <p className="error">{error}</p>}
          {assessment?.validation && (
            <div className={`score-panel ${assessment.passed ? 'score-pass' : 'score-fail'}`}>
              <div className="score-hero">
                <span className="score-ring">{currentScore}%</span>
                <div>
                  <strong>
                    {assessment.passed ? 'Great reading' : `Try the ${scoreScope} again`}
                  </strong>
                  <p>
                    {assessment.passed
                      ? `You matched the ${scoreScope} closely.`
                      : 'Practise the highlighted words, then press Start again.'}
                  </p>
                </div>
              </div>
              {sentenceScores.length > 1 && (
                <div className="sentence-score-list" aria-label="Sentence scores">
                  {sentenceScores.map((s) => (
                    <span
                      key={`sentence-score-${s.sentenceIndex}`}
                      className={`sentence-score-pill ${s.passed ? 'passed' : 'retry'}`}
                    >
                      <span>{s.passed ? '✓' : '!'}</span>
                      Sentence {s.sentenceNumber}: {s.displayScore}%
                    </span>
                  ))}
                </div>
              )}
              {Array.isArray(assessment.validation.wordScores) &&
                assessment.validation.wordScores.length > 0 && (
                  <ul className="word-score-list" aria-label="Per-word phonics scores">
                    {assessment.validation.wordScores.map((w, i) => (
                      <li key={`${w.expected}-${i}`} className={`word-score word-score-${w.status}`}>
                        <span className="word-score-head">
                          <span className="word-score-mark">{wordScoreMark(w.status)}</span>
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

function wordScoreMark(status) {
  if (status === 'exact') return '✓';
  if (status === 'close') return '~';
  return '!';
}

function isRewardEligibleAssessment(msg) {
  const path = String(msg?.path || '').toLowerCase();
  if (!path) return false;
  if (path.includes('typed') || path.includes('demo')) return false;
  return path.includes('whisper') || path.includes('asr');
}

function findNextIncompleteSentence(sentences, results, fromIndex = -1) {
  if (!sentences.length) return null;
  const ordered = [
    ...sentences.filter((s) => s.index > fromIndex),
    ...sentences.filter((s) => s.index <= fromIndex),
  ];
  return ordered.find((s) => !results[s.index]?.passed) || null;
}

function sentenceTitle(sentence, result) {
  if (result?.passed) {
    return `Sentence ${sentence.index + 1} passed with a verified ${result.score}% score`;
  }
  if (result) {
    return `Sentence ${sentence.index + 1} needs retry. Latest score ${result.score}%`;
  }
  return `Select sentence ${sentence.index + 1} to hear and read`;
}

function countWordsInOrder(expectedWords, heardWords) {
  if (!expectedWords.length || !heardWords.length) return 0;
  let cursor = 0;
  for (const heard of heardWords) {
    if (heard === expectedWords[cursor]) cursor += 1;
    if (cursor >= expectedWords.length) break;
  }
  return cursor;
}

function readingLooksComplete(expectedWords, heardWords) {
  if (!expectedWords.length || !heardWords.length) return false;
  const expectedCount = expectedWords.length;
  const lastExpected = expectedWords[expectedCount - 1];
  const recentHeard = heardWords.slice(-3);
  const orderedCount = countWordsInOrder(expectedWords, heardWords);
  const enoughWords = heardWords.length >= expectedCount;
  const heardLastWord = recentHeard.includes(lastExpected);
  return orderedCount >= expectedCount || (enoughWords && heardLastWord);
}
