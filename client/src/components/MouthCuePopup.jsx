import { useEffect, useRef, useState } from 'react';
import MouthCue from './MouthCue.jsx';
import { PHONEME_CUE_EVENT } from '../utils/phonemeCueEvents.js';

export default function MouthCuePopup() {
  const [cue, setCue] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const onCue = (event) => {
      const detail = event.detail || {};
      if (!detail.ipa) return;
      window.clearTimeout(timerRef.current);
      setCue({
        ipa: detail.ipa,
        grapheme: detail.grapheme || '',
        source: detail.source || 'phoneme',
      });
      timerRef.current = window.setTimeout(() => {
        setCue(null);
      }, detail.durationMs || 2600);
    };

    window.addEventListener(PHONEME_CUE_EVENT, onCue);
    return () => {
      window.removeEventListener(PHONEME_CUE_EVENT, onCue);
      window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!cue) return null;

  return (
    <aside className="mouth-cue-popup" aria-live="polite" aria-label="Mouth movement popup">
      <div className="mouth-popup-head">
        <span>Watch the mouth</span>
        <button type="button" onClick={() => setCue(null)} aria-label="Close mouth movement popup">
          x
        </button>
      </div>
      <MouthCue ipa={cue.ipa} grapheme={cue.grapheme} />
    </aside>
  );
}
