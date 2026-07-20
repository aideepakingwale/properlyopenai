import { Router } from 'express';
import { assessmentsRepo, childrenRepo, sessionsRepo, storiesRepo } from '../db/repositories.js';
import { awardSessionRewards } from '../services/rewardService.js';
import { assessHeuristic, persistAssessment } from '../services/assessmentService.js';
import { validateReading } from '../services/validationService.js';
import { recordChildActivity } from '../services/activityService.js';
import { extractWords, splitSentences } from '../../../shared/phonicsEngine.js';

const router = Router();

router.post('/start', (req, res) => {
  const { childId, storyId } = req.body || {};
  if (!childrenRepo.get(childId)) return res.status(404).json({ error: 'child not found' });
  if (!storiesRepo.get(storyId)) return res.status(404).json({ error: 'story not found' });
  const session = sessionsRepo.create({ childId, storyId });
  const activity = recordChildActivity(childId, { type: 'reading_session_start' });
  res.status(201).json({ ...session, child: activity?.child || childrenRepo.get(childId) });
});

router.get('/:id', (req, res) => {
  const session = sessionsRepo.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'not found' });
  const story = storiesRepo.get(session.storyId);
  res.json({ ...session, story });
});

router.post('/:id/validate', (req, res) => {
  const session = sessionsRepo.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'not found' });
  const story = storiesRepo.get(session.storyId);
  const recognized = req.body?.transcript || '';
  const expected =
    (typeof req.body?.expectedText === 'string' && req.body.expectedText.trim()) ||
    story.text;
  const result = assessHeuristic(expected, recognized);
  persistAssessment(session.id, result);
  res.json(result);
});

router.post('/:id/complete', (req, res) => {
  const session = sessionsRepo.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'not found' });
  const story = storiesRepo.get(session.storyId);
  const transcript = String(req.body?.transcript || '').trim();
  const force = Boolean(req.body?.force);
  const expected = story.text;

  if (force) {
    return res.status(422).json({
      error: 'demo_completion_disabled',
      message: 'Demo completion cannot unlock rewards. Pass every sentence with the microphone first.',
      validation: validateReading(expected, transcript),
    });
  }

  if (session.status === 'completed') {
    const child = childrenRepo.get(session.childId);
    return res.json({
      session,
      validation: {
        passed: true,
        combined: session.jaccardScore ?? 0,
        displayScore: Math.round((session.jaccardScore || 0) * 100),
        reason: 'already_completed',
      },
      rewards: {
        child,
        rewards: [],
        alreadyCompleted: true,
        message: 'Rewards were already collected for this reading mission.',
      },
    });
  }

  if (!transcript || !extractWords(transcript).length) {
    return res.status(422).json({
      error: 'no_transcript',
      message:
        'Please read aloud first (Start → Stop & assess). I need to hear every sentence before awarding acorns.',
      validation: validateReading(expected, ''),
    });
  }

  const verified = verifySentenceAssessments(session.id, story);
  if (!verified.complete) {
    return res.status(422).json({
      error: 'missing_verified_sentence_reads',
      message: `Pass every sentence with the microphone first (${verified.passed}/${verified.total} complete).`,
      validation: {
        ...validateReading(expected, transcript),
        sentenceVerification: verified,
        passed: false,
        reason: 'missing_verified_sentence_reads',
      },
    });
  }

  const validation = validateReading(expected, transcript);
  if (!validation.passed) {
    return res.status(422).json({
      error: 'jaccard_below_threshold',
      message:
        validation.reason === 'no_speech_recognized'
          ? 'I did not hear clear words. Read the sentence aloud, then try again.'
          : `Not enough matching words yet (score ${Math.round((validation.combined || 0) * 100)}%). Listen and try again!`,
      validation,
    });
  }

  const updated = sessionsRepo.update(session.id, {
    status: 'completed',
    jaccardScore: validation.combined,
    endedAt: new Date().toISOString(),
  });

  const rewards = awardSessionRewards(session.childId, {
    jaccardScore: validation.combined,
  });

  res.json({ session: updated, validation: { ...validation, sentenceVerification: verified }, rewards });
});

export default router;

function storySentenceTexts(story) {
  const fromMeta = story?.metadata?.sentences;
  if (Array.isArray(fromMeta) && fromMeta.length) {
    return fromMeta.map((s) => String(s || '').trim()).filter(Boolean);
  }
  return splitSentences(story?.text || '', story?.phase || 2).map((s) => s.text);
}

function normWords(text) {
  return extractWords(text).join(' ');
}

function verifySentenceAssessments(sessionId, story) {
  const targets = storySentenceTexts(story);
  const assessments = assessmentsRepo
    .listForSession(sessionId)
    .filter((a) => a.path && a.path !== 'typed-demo' && !a.path.includes('demo'));

  const sentenceChecks = targets.map((text, index) => {
    const targetNorm = normWords(text);
    const matches = assessments.filter((a) => normWords(a.expected) === targetNorm);
    let best = null;
    for (const assessment of matches) {
      const validation = validateReading(text, assessment.recognized || '');
      if (!best || validation.combined > best.validation.combined) {
        best = { assessment, validation };
      }
    }
    return {
      index,
      text,
      expectedWords: targetNorm,
      passed: Boolean(best?.validation?.passed),
      score: best?.validation?.displayScore || 0,
      path: best?.assessment?.path || null,
      assessedAt: best?.assessment?.createdAt || null,
    };
  });

  const passed = sentenceChecks.filter((s) => s.passed).length;
  return {
    total: sentenceChecks.length,
    passed,
    complete: sentenceChecks.length > 0 && passed === sentenceChecks.length,
    sentences: sentenceChecks,
  };
}
