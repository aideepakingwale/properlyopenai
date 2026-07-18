import {
  findDisallowedWords,
  getPhaseVocabulary,
  highlightText,
} from '../../../shared/phonicsEngine.js';
import { buildPracticePack } from '../../../shared/practiceSentences.js';
import { config } from '../config.js';
import { getOpenAI, isMockMode } from './openaiClient.js';
import { storiesRepo } from '../db/repositories.js';

const FEW_SHOT = `
Example Phase 2 story (theme: cat):
Title: The Cat Sat
Text: A cat sat on a mat. The cat had a nap. Dad sat. The cat ran to Dad.

Example Phase 3 story (theme: ship):
Title: The Ship
Text: A ship is on the sea. We see a fish. The fish can swim. She has a wish.
`.trim();

function mockStory(phase, theme, interests) {
  const interest = interests[0] || theme || 'animals';
  const templates = {
    2: {
      title: `The ${capitalize(interest)} Nap`,
      text: `A cat sat on a mat. The cat had a nap. Dad sat. A big dog ran. The cat hid in a bag.`,
    },
    3: {
      title: `Moon and the ${capitalize(interest)}`,
      text: `We see the moon. A ship is on the sea. A fish can swim. She has a wish. Then we hear an owl.`,
    },
    4: {
      title: `Frog at the Pond`,
      text: `A frog can jump from a plant. We stop and clap. Best friends bring a snack. Then we splash and grin.`,
    },
    5: {
      title: `A Day to Play`,
      text: `Today we play by the sea. We make a boat. We like the time at home. They shout with joy.`,
    },
  };
  const t = templates[phase] || templates[2];
  return { title: t.title, text: t.text, theme: interest };
}

function capitalize(s) {
  return String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
}

function buildPrompt(phase, theme, interests) {
  const vocab = [...getPhaseVocabulary(phase)].slice(0, 120).join(', ');
  return `You are writing a UK phonics reading book for Letters and Sounds Phase ${phase}.
Theme/interests: ${[theme, ...interests].filter(Boolean).join(', ') || 'animals'}.

STRICT RULES:
- Use ONLY words appropriate for Phase ${phase} (CVC/simple words for Phase 2; digraphs for Phase 3; adjacent consonants for Phase 4; alternative spellings for Phase 5).
- Prefer these words: ${vocab}
- 4 to 6 short sentences.
- Warm, encouraging, child-friendly.
- Title under 6 words.
- No advanced vocabulary, no slang.

${FEW_SHOT}

Respond as JSON only: {"title":"...","text":"..."}`;
}

async function generateWithOpenAI(phase, theme, interests) {
  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: config.chatModel,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You write tightly constrained phonics stories for UK Letters and Sounds. Never invent advanced vocabulary.',
      },
      { role: 'user', content: buildPrompt(phase, theme, interests) },
    ],
  });
  const raw = completion.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);
  return {
    title: String(parsed.title || 'My Story').slice(0, 80),
    text: String(parsed.text || '').trim(),
    theme: theme || interests[0] || 'adventure',
  };
}

/**
 * Generate a phase-constrained story; retry once if allowlist fails; fall back to mock.
 */
export async function generateStory({ phase = 2, theme = '', interests = [], childId = null }) {
  let draft;
  let source = 'mock';

  if (isMockMode()) {
    draft = mockStory(phase, theme, interests);
  } else {
    try {
      draft = await generateWithOpenAI(phase, theme, interests);
      source = config.chatModel;
      let bad = findDisallowedWords(draft.text, phase);
      if (bad.length > 3) {
        // Retry once with stricter reminder
        const retry = await generateWithOpenAI(phase, theme, interests);
        const bad2 = findDisallowedWords(retry.text, phase);
        if (bad2.length < bad.length) {
          draft = retry;
          bad = bad2;
        }
      }
      if (!draft.text?.trim() || findDisallowedWords(draft.text, phase).length > 6) {
        draft = mockStory(phase, theme, interests);
        source = draft.text?.trim() ? 'mock-fallback' : 'mock-empty';
      }
    } catch (err) {
      console.warn('Story generation failed, using mock:', err.message);
      draft = mockStory(phase, theme, interests);
      source = 'mock-error';
    }
  }

  if (!draft?.text?.trim()) {
    draft = mockStory(phase, theme, interests);
    source = 'mock-empty';
  }

  const disallowed = findDisallowedWords(draft.text, phase);
  const story = storiesRepo.create({
    phase,
    theme: draft.theme,
    title: draft.title,
    text: draft.text,
    metadata: {
      source,
      childId,
      disallowed,
      highlight: highlightText(draft.text, phase),
    },
  });

  return story;
}

/**
 * Create a curated sentence pack for reading + per-sentence assessment.
 * Always available offline (no OpenAI).
 */
export function createPracticeStory({ phase = 2, theme = 'practice', childId = null, count } = {}) {
  const pack = buildPracticePack(phase, { theme, count });
  return storiesRepo.create({
    phase: pack.phase,
    theme: pack.theme,
    title: pack.title,
    text: pack.text,
    metadata: {
      source: 'practice-pack',
      kind: 'practice',
      childId,
      sentences: pack.sentences,
      highlight: highlightText(pack.text, pack.phase),
    },
  });
}

/**
 * @param {{ childName?: string, phase?: number, context?: string, issue?: string, targetSentence?: string }} opts
 */
export async function coachMessage({
  childName,
  phase,
  context,
  issue,
  targetSentence = '',
}) {
  const passed = !issue || issue === 'none' || issue === 'pass';
  const practiceLine = String(targetSentence || '').trim();
  const name = childName || 'little reader';

  // Deterministic lines — never rehearse Whisper's mis-hearing
  const localMessage = passed
    ? `Well done, ${name}! That matched the words — Mrs Owl is proud of you.`
    : practiceLine
      ? `Good try, ${name}! Let's practise the real line: "${practiceLine}". Read it slowly once more.`
      : `Good try, ${name}! Listen to the sentence again, then read it slowly.`;

  if (isMockMode()) {
    return { message: localMessage, voiceHint: 'warm' };
  }

  const openai = getOpenAI();
  if (!openai) {
    return { message: localMessage, voiceHint: 'warm' };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: config.chatModel,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: `You are Mrs Owl, a warm UK phonics tutor for ages 4–7. Max 2 short sentences. British English.
If PASSED: celebrate.
If FAILED: ask them to try again. You MUST quote ONLY this practice sentence (never quote a wrong Whisper guess): ${practiceLine || '(use context)'}.`,
        },
        {
          role: 'user',
          content: `Child: ${name}, Phase ${phase}. Practice sentence: "${practiceLine}". Extra: ${context || ''}. Result: ${passed ? 'PASSED' : `FAILED (${issue})`}.`,
        },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim();
    return { message: text || localMessage, voiceHint: 'warm' };
  } catch (err) {
    console.warn('Coach LLM unavailable, using local line:', err.message);
    return { message: localMessage, voiceHint: 'warm' };
  }
}
