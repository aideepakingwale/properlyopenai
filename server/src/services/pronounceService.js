import { buildPronunciationLesson } from '../../../shared/phonicsEngine.js';
import { synthesizeSpeech } from './ttsService.js';

/**
 * Build a Mrs Owl pronunciation lesson and optional TTS audio.
 */
export async function createPronunciationGuide(input, { speak = true } = {}) {
  const lesson = buildPronunciationLesson(input || {});
  let audio = null;
  if (speak && lesson.speakText) {
    try {
      audio = await synthesizeSpeech(lesson.speakText);
    } catch (err) {
      console.warn('Pronounce TTS skipped:', err.message);
      audio = { mock: true, url: null, text: lesson.speakText };
    }
  }
  return { ...lesson, audio };
}
