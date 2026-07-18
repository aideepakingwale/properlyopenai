import fs from 'fs';
import { config } from '../config.js';
import { getDb } from './index.js';
import { childrenRepo, storiesRepo, rewardsRepo } from './repositories.js';
import { generateStoryPdf } from '../services/pdfService.js';
import { generateIllustration } from '../services/illustrationService.js';

async function seed() {
  fs.mkdirSync(config.storageDir, { recursive: true });
  getDb();

  const existing = childrenRepo.list();
  if (existing.length) {
    console.log('Seed skipped — children already exist:', existing.map((c) => c.name).join(', '));
    return;
  }

  const child = childrenRepo.create({
    name: 'Amelia',
    interests: ['dragons', 'space', 'animals'],
    phase: 2,
  });

  let story = storiesRepo.create({
    phase: 2,
    theme: 'practice',
    title: 'Phase 2 practice sentences',
    text: 'A cat sat on a mat. The cat had a nap. Dad sat on a log. A big dog ran to the cat. The cat hid in a bag. I can go into the tent.',
    metadata: {
      source: 'seed',
      kind: 'practice',
      sentences: [
        'A cat sat on a mat.',
        'The cat had a nap.',
        'Dad sat on a log.',
        'A big dog ran to the cat.',
        'The cat hid in a bag.',
        'I can go into the tent.',
      ],
    },
  });

  const illustration = await generateIllustration({
    title: story.title,
    theme: story.theme,
    text: story.text,
    phase: story.phase,
  });
  story = storiesRepo.updatePaths(story.id, { illustrationUrl: illustration.url });
  const pdf = await generateStoryPdf(story);
  story = storiesRepo.updatePaths(story.id, { pdfPath: pdf.url });

  rewardsRepo.create({
    childId: child.id,
    type: 'trophy_welcome',
    label: 'Welcome Acorn Badge',
    meta: { seed: true },
  });

  console.log('Seeded child:', child.id, child.name);
  console.log('Seeded story:', story.id, story.title);
  console.log('Mock mode:', config.mockMode);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
