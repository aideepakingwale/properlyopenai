import OpenAI from 'openai';
import { config } from '../config.js';

let client = null;

export function getOpenAI() {
  if (config.mockMode) return null;
  if (!client) {
    client = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return client;
}

export function isMockMode() {
  return config.mockMode;
}
