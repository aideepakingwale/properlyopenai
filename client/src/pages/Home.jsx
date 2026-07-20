import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAppStore } from '../store';
import MrsOwl from '../components/MrsOwl';

export default function Home() {
  const navigate = useNavigate();
  const child = useAppStore((s) => s.child);
  const story = useAppStore((s) => s.story);
  const session = useAppStore((s) => s.session);
  const setStory = useAppStore((s) => s.setStory);
  const setSession = useAppStore((s) => s.setSession);
  const setChild = useAppStore((s) => s.setChild);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [avatarMessage, setAvatarMessage] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [owl, setOwl] = useState(
    `Welcome back, ${child?.name || 'reader'}! Choose a story or practice sentences to read aloud.`,
  );

  useEffect(() => {
    if (!child?.id) return;
    api.getChild(child.id).then(setChild).catch(() => {});
  }, [child?.id, setChild]);

  if (!child) {
    return (
      <p>
        No profile yet. <Link to="/start">Start onboarding</Link>
      </p>
    );
  }

  const startWithStory = async (nextStory, label) => {
    setBusy(label);
    setError('');
    try {
      setStory(nextStory);
      const nextSession = await api.startSession({ childId: child.id, storyId: nextStory.id });
      if (nextSession.child) setChild(nextSession.child);
      setSession(nextSession);
      try {
        const coach = await api.coach({
          childId: child.id,
          context: `Starting "${nextStory.title}"`,
          speak: true,
        });
        setOwl(coach.message);
        if (coach.audio?.url) {
          new Audio(coach.audio.url).play().catch(() => {});
        }
      } catch {
        setOwl(`Let's read: ${nextStory.title}`);
      }
      navigate('/read');
    } catch (err) {
      setError(err.message || 'Could not start session');
      throw err;
    } finally {
      setBusy('');
    }
  };

  const beginReading = async () => {
    setBusy('story');
    setError('');
    try {
      const interests = child.interests || [];
      const theme = interests.length
        ? interests[Math.floor(Math.random() * interests.length)]
        : 'animals';
      const next = await api.generateStory({
        childId: child.id,
        phase: child.phase,
        interests,
        theme,
      });
      await startWithStory(next, 'story');
    } catch (err) {
      setError(err.message || 'Could not start session');
      setBusy('');
    }
  };

  const beginPractice = async () => {
    setBusy('practice');
    setError('');
    try {
      const pack = await api.createPracticePack({
        childId: child.id,
        phase: child.phase,
        theme: 'practice',
      });
      setOwl(
        `Here are ${pack.sentences?.length || 6} Phase ${child.phase} sentences. Pick one, listen, then read it aloud.`,
      );
      await startWithStory(
        { ...pack, kind: 'practice' },
        'practice',
      );
    } catch (err) {
      setError(err.message || 'Could not start practice');
      setBusy('');
    }
  };

  const continueReading = () => {
    if (story && session) navigate('/read');
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !child?.id) return;
    setAvatarError('');
    if (!isLikelyImageFile(file)) {
      setAvatarMessage('');
      setAvatarError('Please choose a photo or image file.');
      return;
    }
    if (file.size > 10_000_000) {
      setAvatarMessage('');
      setAvatarError('Please choose an image below 10 MB.');
      return;
    }
    setBusy('avatar');
    setAvatarMessage('Preparing avatar...');
    setError('');
    try {
      const { image, note } = await prepareAvatarDataUrl(file);
      setAvatarMessage(note || 'Uploading avatar...');
      const updated = await api.uploadChildAvatar(child.id, image);
      setChild(updated);
      setAvatarMessage('Avatar saved. Your quest marker is now personalised.');
    } catch (err) {
      setAvatarMessage('');
      setAvatarError(err.message || 'Could not upload avatar');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="home">
      <div className="home-hero">
        <div className="kid-badge">Reader clubhouse</div>
        <h1>Hello, {child.name}</h1>
        <p>
          Phase {child.phase} · {child.interests?.join(', ') || 'open themes'}
        </p>
        {story?.illustrationUrl && (
          <div className="home-story-preview">
            <img src={story.illustrationUrl} alt="" width={180} height={180} />
            <div>
              <span>Ready to read</span>
              <strong>{story.title}</strong>
            </div>
          </div>
        )}
        <MrsOwl message={owl} />
      </div>

      <div className="home-actions">
        <div className="profile-settings-card">
          <div className="profile-avatar-preview">
            <img
              src={child.avatarUrl || '/images/mrs-owl-realistic.png'}
              alt={`${child.name}'s quest avatar`}
              width="72"
              height="72"
            />
          </div>
          <div>
            <span className="eyebrow">Profile settings</span>
            <strong>Quest avatar</strong>
            <p>Upload a profile picture to move through the Phonics Quest map.</p>
            <label className={`btn ghost avatar-upload-btn ${busy === 'avatar' ? 'is-busy' : ''}`}>
              {busy === 'avatar' ? 'Saving...' : 'Upload picture'}
              <input
                type="file"
                accept="image/*,.heic,.heif"
                onChange={uploadAvatar}
                disabled={busy === 'avatar'}
              />
            </label>
            {(avatarMessage || avatarError) && (
              <small className={avatarError ? 'avatar-upload-error' : 'avatar-upload-status'} aria-live="polite">
                {avatarError || avatarMessage}
              </small>
            )}
          </div>
        </div>

        <button
          className="btn primary lg"
          onClick={beginPractice}
          disabled={Boolean(busy)}
        >
          {busy === 'practice' ? 'Loading sentences…' : 'Practice sentences'}
        </button>
        <button
          className="btn secondary lg"
          onClick={beginReading}
          disabled={Boolean(busy)}
        >
          {busy === 'story' ? 'Writing and painting…' : 'Read a new story'}
        </button>
        {story && session && (
          <button className="btn ghost lg" onClick={continueReading} disabled={Boolean(busy)}>
            Continue: {story.title}
          </button>
        )}
        <p className="home-hint">
          <strong>Practice sentences</strong> gives short phase-safe lines to hear, read aloud, and
          score. Use a full story when you want a longer page.
        </p>
        <div className="quick-links">
          <Link to="/guide">Phonics guide</Link>
          <Link to="/progress">See progress</Link>
          <Link to="/rewards">Acorns & trophies</Link>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    </section>
  );
}

async function prepareAvatarDataUrl(file) {
  const original = await readFileAsDataUrl(file);
  try {
    const img = await loadImage(original);
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available.');
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    const sourceSize = Math.min(width, height);
    const sx = (width - sourceSize) / 2;
    const sy = (height - sourceSize) / 2;
    ctx.drawImage(img, sx, sy, sourceSize, sourceSize, 0, 0, size, size);

    const blob = await new Promise((resolve) => {
      canvas.toBlob((value) => resolve(value), 'image/webp', 0.82);
    });
    const finalBlob = blob && blob.size ? blob : await new Promise((resolve) => {
      canvas.toBlob((value) => resolve(value), 'image/jpeg', 0.84);
    });
    if (!finalBlob) throw new Error('Browser compression failed.');
    return {
      image: await readFileAsDataUrl(finalBlob),
      note: 'Uploading avatar...',
    };
  } catch {
    return {
      image: original,
      note: 'Uploading original photo...',
    };
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not prepare this image.'));
    img.src = src;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}

function isLikelyImageFile(file) {
  if (file.type?.startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif|avif|heic|heif|bmp|tiff?)$/i.test(file.name || '');
}
