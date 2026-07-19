import { Link } from 'react-router-dom';
import { useAppStore } from '../store';

const FEATURE_BLOCKS = [
  {
    title: 'Personal story builder',
    label: 'Story',
    tone: 'coral',
    text:
      "Creates phase-safe stories from the child's reading level and favourite topics, then reuses cached pictures when the same idea appears again.",
  },
  {
    title: 'Listen before reading',
    label: 'Hear',
    tone: 'blue',
    text:
      'Children can hear phonemes, words, and whole sentences in a friendly order before they try reading aloud.',
  },
  {
    title: 'Read-aloud scoring',
    label: 'Mic',
    tone: 'leaf',
    text:
      "The microphone flow waits until it is ready, captures the child's attempt, and shows heard words with a fresh score for each retry.",
  },
  {
    title: 'Mouth movement cues',
    label: 'Cue',
    tone: 'berry',
    text:
      'Realistic mouth visuals show lips, tongue, airflow, and direction arrows so children can see how each sound is made.',
  },
  {
    title: 'Phonics quest rewards',
    label: 'Quest',
    tone: 'amber',
    text:
      'Acorns, streaks, badges, treasure chests, and a journey map make practice feel like progress through an adventure.',
  },
  {
    title: 'Teacher and parent outputs',
    label: 'PDF',
    tone: 'ink',
    text:
      'Branded printable PDFs, grown-up summaries, and progress milestones help adults understand what to practise next.',
  },
];

const STEPS = [
  {
    number: '01',
    title: 'Create a reader profile',
    text: 'Choose a phonics phase, topics the student loves, and optionally upload a profile picture for the quest avatar.',
  },
  {
    number: '02',
    title: 'Generate or practise',
    text: 'Start with short sentences or a new story. Images are low resolution and cached to control server cost.',
  },
  {
    number: '03',
    title: 'Listen, speak, score',
    text: 'Tap a sound, word, or line. Then read aloud once the mic is ready and see exactly which words were heard.',
  },
  {
    number: '04',
    title: 'Unlock the next milestone',
    text: 'Rewards explain what to complete next, from hearing sounds to reading sentences and collecting badges.',
  },
];

const DASHBOARD_POINTS = [
  'AI-generated story pictures cached for reuse',
  '44 phoneme sound practice with visual mouth cues',
  'Fresh scoring on every retry, with heard-word feedback',
  'Quest map, acorns, streaks, and milestone rewards',
];

const QUEST_STAGES = [
  {
    order: 1,
    icon: 'Ear',
    title: 'Sound Forest',
    milestone: 'Finish your first read aloud',
    reward: 'Sound Explorer Badge',
    benefit: 'Builds confidence hearing and copying first sounds.',
  },
  {
    order: 2,
    icon: 'Br',
    title: 'Blend Bridge',
    milestone: 'Complete 3 story missions',
    reward: 'Blend Builder Chest',
    benefit: 'Turns separate sounds into smooth short words.',
  },
  {
    order: 3,
    icon: 'Wd',
    title: 'Word Meadow',
    milestone: 'Finish 5 phase reads',
    reward: 'Word Gardener Badge',
    benefit: 'Grows accuracy with phase-safe words.',
  },
  {
    order: 4,
    icon: 'Vo',
    title: 'Sentence Stream',
    milestone: 'Score 80% or more once',
    reward: 'Clear Voice Star',
    benefit: 'Encourages clear full-sentence reading.',
  },
  {
    order: 5,
    icon: 'Mt',
    title: 'Story Mountain',
    milestone: 'Score 90% on read aloud',
    reward: 'Story Champion Flag',
    benefit: 'Motivates fluent whole-story reading.',
  },
  {
    order: 6,
    icon: 'Key',
    title: 'Treasure Library',
    milestone: 'Collect 100 acorns',
    reward: 'Library Key',
    benefit: 'Rewards steady practice and reading habit.',
  },
];

export default function Landing() {
  const child = useAppStore((s) => s.child);
  const primaryPath = child?.id ? '/home' : '/start';
  const primaryLabel = child?.id ? 'Open reader dashboard' : 'Start a child profile';

  return (
    <div className="landing-page">
      <section className="landing-hero">
        <div className="landing-hero-content">
          <p className="landing-kicker">AI phonics coach for UK Letters and Sounds</p>
          <h1>Mrs Owl turns reading practice into a phonics adventure.</h1>
          <p className="landing-hero-copy">
            Properly helps children hear, see, and read phonemes through personalised
            stories, mouth movement cues, read-aloud scoring, and playful quest rewards.
          </p>
          <div className="landing-hero-actions">
            <Link className="btn primary lg" to={primaryPath}>
              {primaryLabel}
            </Link>
            <a className="btn ghost lg landing-light-btn" href="#features">
              Explore features
            </a>
          </div>
          <div className="landing-proof-row" aria-label="Product highlights">
            <span>Phase-safe stories</span>
            <span>Cached story images</span>
            <span>Read-aloud feedback</span>
          </div>
        </div>
      </section>

      <section className="landing-feature-band" id="features">
        <div className="landing-section-head">
          <p className="eyebrow">Everything in one learning loop</p>
          <h2>Built to keep young readers moving.</h2>
          <p>
            The app combines story choice, listening, pronunciation support, assessment, and
            rewards so practice feels clear for children and useful for grown-ups.
          </p>
        </div>

        <div className="landing-feature-grid">
          {FEATURE_BLOCKS.map((feature) => (
            <article className="landing-feature-card" key={feature.title}>
              <span className={`landing-feature-symbol tone-${feature.tone}`}>
                {feature.label}
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-showcase" id="quest">
        <div className="landing-showcase-copy">
          <p className="eyebrow">The game layer</p>
          <h2>A visible quest, not a dull report card.</h2>
          <p>
            Children see where they are on the phonics journey and what unlocks next.
            Parents and teachers still get the useful summary, but the child&apos;s view stays
            playful and motivating.
          </p>
          <ul>
            {DASHBOARD_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <Link className="btn secondary" to={child?.id ? '/progress' : '/start'}>
            See the quest map
          </Link>
        </div>
        <div className="landing-map-panel" aria-label="Phonics quest map preview">
          <img src="/images/quest/phonics-quest-map.webp" alt="" />
          <div className="landing-route-motion" aria-hidden="true">
            {QUEST_STAGES.map((stage) => (
              <span
                className={`landing-route-dot route-dot-${stage.order}`}
                key={stage.order}
              />
            ))}
            <span className="landing-route-spark" />
          </div>
          <img
            className="landing-owl-token"
            src={child?.avatarUrl || '/images/mrs-owl-realistic.png'}
            alt=""
          />
          {QUEST_STAGES.map((stage) => (
            <article
              className={`landing-map-stage landing-map-stage-${stage.order}`}
              key={stage.title}
            >
              <span>{stage.order}</span>
              <strong>{stage.title}</strong>
              <small>{stage.reward}</small>
            </article>
          ))}
        </div>
        <div className="landing-quest-rewards" aria-label="Quest milestones and rewards">
          {QUEST_STAGES.map((stage) => (
            <article className="landing-reward-card" key={stage.title}>
              <span className="landing-reward-icon">{stage.icon}</span>
              <strong>{stage.title}</strong>
              <small>Milestone: {stage.milestone}</small>
              <p>Reward: {stage.reward}</p>
              <em>{stage.benefit}</em>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-steps-band">
        <div className="landing-section-head">
          <p className="eyebrow">How it works</p>
          <h2>From favourite topic to confident reading.</h2>
        </div>
        <div className="landing-step-grid">
          {STEPS.map((step) => (
            <article className="landing-step" key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-practice-band">
        <div className="landing-media-stack">
          <img src="/images/mouth-cues/tongue-tap.webp" alt="" />
          <img src="/images/mouth-cues/open-vowel.webp" alt="" />
          <img src="/images/mouth-cues/round-lips.webp" alt="" />
        </div>
        <div>
          <p className="eyebrow">Pronunciation support</p>
          <h2>Show children what the sound looks like.</h2>
          <p>
            MouthCue popups appear anywhere phonemes are introduced, pairing sound playback
            with lips, tongue, and movement arrows. It gives students another way to copy the
            sound before reading the word or sentence.
          </p>
          <div className="landing-mini-grid">
            <span>Phoneme sounds</span>
            <span>Word blending</span>
            <span>Sentence reading</span>
            <span>Retry feedback</span>
          </div>
        </div>
      </section>

      <section className="landing-final-cta">
        <img src="/images/mrs-owl-realistic.png" alt="" />
        <div>
          <p className="eyebrow">Ready for a reading quest?</p>
          <h2>Start with one profile and one story.</h2>
          <p>
            Properly is designed for short, repeatable practice sessions that reward effort,
            guide the next step, and make reading feel less like homework.
          </p>
        </div>
        <Link className="btn primary lg" to={primaryPath}>
          {primaryLabel}
        </Link>
      </section>
    </div>
  );
}
