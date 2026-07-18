import OpenAI from 'openai';
import { config } from '../config.js';

let client = null;

/**
 * @param {{ ignoreMock?: boolean }} [opts]
 * ignoreMock: use the API key even when MOCK_MODE is on (Whisper / images).
 */
export function getOpenAI({ ignoreMock = false } = {}) {
  const key = (config.openaiApiKey || '').trim();
  if (!key) return null;
  if (config.mockMode && !ignoreMock) return null;
  if (!client) {
    client = new OpenAI({ apiKey: key });
  }
  return client;
}

export function isMockMode() {
  return config.mockMode;
}

export function hasOpenAIKey() {
  return Boolean((config.openaiApiKey || '').trim());
}
