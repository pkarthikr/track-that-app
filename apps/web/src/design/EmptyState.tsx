import "./EmptyState.css";

export function EmptyState() {
  return (
    <div className="empty-state">
      <svg
        className="empty-state__arrow"
        aria-hidden="true"
        width="70"
        height="170"
        viewBox="0 0 70 170"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 162 C 8 100, 22 50, 48 10" />
        <path d="M35.5 16.3 L48 10 L47.3 24" />
      </svg>
      <div className="empty-state__badge">
        <svg
          aria-hidden="true"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 21V11" />
          <path d="M12 13C12 9 9 7 5 7c0 4 3 6 7 6z" />
          <path d="M12 11c0-3 2-5 6-5 0 3-2 5-6 5z" />
        </svg>
      </div>
      <h2 className="empty-state__title">No habits yet</h2>
      <p className="empty-state__hint">Tap the + at the top right to add your first habit.</p>
    </div>
  );
}
