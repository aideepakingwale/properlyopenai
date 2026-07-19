import { Link } from 'react-router-dom';
import { useAppStore } from '../store';

const FEATURE_BLOCKS = [
  {
    title: 'Personal story builder',
    label: 'Story',
    tone: 'coral',
    text:
      "Builds short, phase-safe stories around the child's reading level and favourite topics, with relevant pictures to keep them curious.",
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
      'Children get supportive read-aloud feedback after they speak, including heard words and what to practise next.',
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
    title: 'Reading book and progress',
    label: 'Book',
    tone: 'ink',
    text:
      'Branded reading books, grown-up summaries, and progress milestones help adults understand what to practise next.',
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
    text: "Start with short practice sentences or a new illustrated story chosen around the child's interests.",
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
  'Relevant story pictures that support comprehension',
  'Phoneme sound practice with visual mouth cues',
  'Supportive read-aloud feedback after each attempt',
  'Quest map, acorns, streaks, and milestone rewards',
];

const QUEST_STAGES = [
  {
    order: 1,
    icon: 'Ear',
    title: 'Sound Forest',
    point: [9, 30],
    milestone: 'Finish your first read aloud',
    reward: 'Sound Explorer Badge',
    benefit: 'Builds confidence hearing and copying first sounds.',
  },
  {
    order: 2,
    icon: 'Br',
    title: 'Blend Bridge',
    point: [31, 27],
    milestone: 'Complete 3 story missions',
    reward: 'Blend Builder Chest',
    benefit: 'Turns separate sounds into smooth short words.',
  },
  {
    order: 3,
    icon: 'Wd',
    title: 'Word Meadow',
    point: [70, 29],
    milestone: 'Finish 5 phase reads',
    reward: 'Word Gardener Badge',
    benefit: 'Grows accuracy with phase-safe words.',
  },
  {
    order: 4,
    icon: 'Vo',
    title: 'Sentence Stream',
    point: [50, 44],
    milestone: 'Score 80% or more once',
    reward: 'Clear Voice Star',
    benefit: 'Encourages clear full-sentence reading.',
  },
  {
    order: 5,
    icon: 'Mt',
    title: 'Story Mountain',
    point: [20, 58.5],
    milestone: 'Score 90% on read aloud',
    reward: 'Story Champion Flag',
    benefit: 'Motivates fluent whole-story reading.',
  },
  {
    order: 6,
    icon: 'Key',
    title: 'Treasure Library',
    point: [88, 59.5],
    milestone: 'Collect 100 acorns',
    reward: 'Library Key',
    benefit: 'Rewards steady practice and reading habit.',
  },
];

const QUEST_PATH =
  'M 9 30 C 15 29.5 23 28.4 31 27 C 40 25.5 49 25.9 58 27.5 C 64 28.5 68 28.8 70 29 C 80 30.4 82 36.4 73 40 C 64 43.4 57 41.5 50 44 C 41.5 47.2 33.5 52.3 25 56.2 C 22.6 57.4 21.1 58 20 58.5 C 28.5 60.4 39 60.2 50 57.5 C 63.5 54.1 78 55.4 88 59.5';

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
            <span>Illustrated reading quests</span>
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
          <svg
            className="landing-route-svg"
            viewBox="0 0 100 62.5"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <defs>
              <path id="landingQuestMotionPath" d={QUEST_PATH} />
              <clipPath id="landingQuestAvatarClip">
                <circle cx="0" cy="0" r="4.7" />
              </clipPath>
            </defs>
            <use href="#landingQuestMotionPath" className="landing-route-guide" />
            <use href="#landingQuestMotionPath" className="landing-route-glow" />
            {QUEST_STAGES.map((stage) => (
              <g
                className={`landing-route-node route-node-${stage.order}`}
                transform={`translate(${stage.point[0]} ${stage.point[1]})`}
                key={stage.order}
              >
                <circle className="landing-route-node-halo" r="2.3" />
                <circle className="landing-route-node-dot" r="1.1" />
              </g>
            ))}
            <circle className="landing-route-spark" r="1.25">
              <animateMotion dur="20s" repeatCount="indefinite">
                <mpath href="#landingQuestMotionPath" />
              </animateMotion>
            </circle>
            <g className="landing-owl-motion">
              <animateMotion dur="20s" repeatCount="indefinite">
                <mpath href="#landingQuestMotionPath" />
              </animateMotion>
              <circle className="landing-owl-motion-ring" r="6.15" />
              <circle className="landing-owl-motion-frame" r="5.25" />
              <image
                className="landing-owl-motion-photo"
                href={child?.avatarUrl || '/images/mrs-owl-realistic.png'}
                x="-4.7"
                y="-4.7"
                width="9.4"
                height="9.4"
                preserveAspectRatio="xMidYMid slice"
                clipPath="url(#landingQuestAvatarClip)"
              />
            </g>
          </svg>
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
            Pronunciation popups appear anywhere phonemes are introduced, pairing sound playback
            with lips, tongue, and movement arrows. It gives students another way to copy the
            sound before reading the word or sentence.
          </p>
          <div className="landing-mini-grid">
            <span>Phoneme sounds</span>
            <span>Word blending</span>
            <span>Sentence reading</span>
            <span>Gentle feedback</span>
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
