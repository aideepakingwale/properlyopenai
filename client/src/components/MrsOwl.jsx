export default function MrsOwl({ message, speaking = false }) {
  return (
    <aside className={`mrs-owl ${speaking ? 'speaking' : ''}`} aria-live="polite">
      <div className="owl-avatar" aria-hidden="true">
        <img src="/images/mrs-owl-icon.png" alt="" width="104" height="104" />
        {speaking && <span className="owl-eq" aria-hidden="true" />}
      </div>
      <div className="owl-bubble">
        <strong>Mrs Owl {speaking ? '· speaking' : ''}</strong>
        <p>{message || 'Hello, little reader! Tap a letter or word and I will show you how to say it.'}</p>
      </div>
    </aside>
  );
}
