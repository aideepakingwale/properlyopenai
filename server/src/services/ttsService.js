import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { config } from '../config.js';
import { getOpenAI, isMockMode } from './openaiClient.js';

export async function synthesizeSpeech(text) {
  fs.mkdirSync(path.join(config.storageDir, 'audio'), { recursive: true });

  if (isMockMode()) {
    return {
      mock: true,
      url: null,
      text,
    };
  }

  try {
    const openai = getOpenAI();
    const filename = `${uuid()}.mp3`;
    const filepath = path.join(config.storageDir, 'audio', filename);
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: config.ttsVoice,
      input: text.slice(0, 4096),
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    return {
      mock: false,
      url: `/storage/audio/${filename}`,
      text,
    };
  } catch (err) {
    console.warn('TTS unavailable, client will use browser speech:', err.message);
    return {
      mock: true,
      url: null,
      text,
      error: err.message,
    };
  }
}
