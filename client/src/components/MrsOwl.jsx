export default function MrsOwl({ message, speaking = false }) {
  return (
    <aside className={`mrs-owl ${speaking ? 'speaking' : ''}`} aria-live="polite">
      <div className="owl-avatar" aria-hidden="true">
        <svg viewBox="0 0 120 120" width="88" height="88">
          <ellipse cx="60" cy="70" rx="42" ry="38" fill="#8D6E63" />
          <ellipse cx="60" cy="48" rx="34" ry="30" fill="#A1887F" />
          <circle cx="45" cy="48" r="12" fill="#FFF8E7" />
          <circle cx="75" cy="48" r="12" fill="#FFF8E7" />
          <circle cx="45" cy="48" r="5" fill="#1B4332" />
          <circle cx="75" cy="48" r="5" fill="#1B4332" />
          <polygon points="60,58 50,70 70,70" fill="#F4A261" />
          <ellipse cx="28" cy="72" rx="10" ry="16" fill="#6D4C41" />
          <ellipse cx="92" cy="72" rx="10" ry="16" fill="#6D4C41" />
        </svg>
      </div>
      <div className="owl-bubble">
        <strong>Mrs Owl</strong>
        <p>{message || 'Hello, little reader! Shall we practise phonics together?'}</p>
      </div>
    </aside>
  );
}
