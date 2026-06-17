import React from 'react';

/**
 * LoadErrorBanner — surfaces a failed data load to the user instead of
 * letting the page render an empty/blank state silently.
 *
 * Used in Core pages that fetch on mount (Dashboard, Insights). Without
 * this banner, a failed fetch is logged to the console and the user
 * sees an empty page that looks identical to "no data yet" — which is
 * a particularly bad UX on the Render free-tier demo because the backend
 * sleeps after ~15 min of inactivity and the first request after that
 * takes 30s+ to wake. With this banner the user knows what's happening
 * and has a retry button.
 *
 * Props:
 *   onRetry  — required, invoked when the user clicks Retry
 *   message  — optional, overrides the default text
 */
const LoadErrorBanner = ({ onRetry, message }) => (
  <div
    role="alert"
    aria-live="polite"
    style={{
      margin: 'var(--spacing-md) 0',
      padding: 'var(--spacing-md) var(--spacing-lg)',
      background: '#fff5e0',
      color: '#7b341e',
      border: '1px solid #f6c97a',
      borderLeft: '4px solid #dd6b20',
      borderRadius: 'var(--radius-md)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 'var(--spacing-md)',
      flexWrap: 'wrap',
    }}
  >
    <div style={{ flex: 1, minWidth: 220 }}>
      <strong>Could not load this page right now.</strong>
      <div style={{ marginTop: 4, fontSize: '0.92em', lineHeight: 1.45 }}>
        {message || 'The server may be waking up (free-tier demos sleep after 15 minutes of inactivity). The first request after a quiet period can take 30 seconds.'}
      </div>
    </div>
    <button
      type="button"
      onClick={onRetry}
      style={{
        padding: '6px 14px',
        background: '#dd6b20',
        color: '#fff',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: '0.92em',
      }}
    >
      Retry
    </button>
  </div>
);

export default LoadErrorBanner;
