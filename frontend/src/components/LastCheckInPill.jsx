import React from 'react';
import { Link } from 'react-router-dom';

/**
 * LastCheckInPill — small re-engagement nudge for the Dashboard.
 *
 * D1 from `[[mindspace-feature-enhancement-audit]]`. Shows the user
 * how long since their last check-in with a gentle prompt back to
 * the Mood Tracker. Day-precision (entry_date is a DATE column on
 * mood_entries).
 *
 * Copy is chosen to avoid two failure modes:
 *   (1) Shaming long absences — "Where have you been?" or alarming
 *       language is contraindicated for mental-health re-engagement.
 *       We use neutral "Last check-in X days ago" and frame the CTA
 *       as an invitation, not a demand.
 *   (2) Pretending recent activity is fresh data — if the user
 *       checked in 2 weeks ago, "Welcome back" reads as a lie.
 *
 * Props:
 *   totalEntries     number       — from statistics.total_entries
 *   lastEntryDate    string|null  — ISO date from statistics.last_entry_date
 */

const _msPerDay = 24 * 60 * 60 * 1000;

const formatRelativeDays = (days) => {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7)   return `${days} days ago`;
  if (days < 14)  return 'about a week ago';
  if (days < 21)  return 'about 2 weeks ago';
  if (days < 30)  return 'about 3 weeks ago';
  if (days < 60)  return `over a month ago`;
  return `over ${Math.floor(days / 30)} months ago`;
};

// Pill tone shifts with recency. Recent = warm and inviting; older =
// gentler nudge. Never alarming — even at 30+ days the colour is
// soft amber, not red.
const _toneFor = (days) => {
  if (days === null)        return { bg: 'rgba(155,138,165,0.12)', fg: '#5b4a64', accent: 'var(--primary-color)' };
  if (days === 0)           return { bg: 'rgba(56,161,105,0.14)',  fg: '#1f5132', accent: '#38a169' };
  if (days <= 2)            return { bg: 'rgba(155,138,165,0.14)', fg: '#5b4a64', accent: 'var(--primary-color)' };
  if (days <= 7)            return { bg: 'rgba(245,201,179,0.30)', fg: '#7b341e', accent: '#dd6b20' };
  return                       { bg: 'rgba(245,201,179,0.40)', fg: '#7b341e', accent: '#c05621' };
};

const LastCheckInPill = ({ totalEntries, lastEntryDate }) => {
  // Brand-new user: invite, do not shame
  if (!totalEntries || totalEntries === 0 || !lastEntryDate) {
    const tone = _toneFor(null);
    return (
      <Link to="/mood-tracker" style={{ ...pillStyle, background: tone.bg, color: tone.fg, borderLeft: `3px solid ${tone.accent}` }}>
        <span aria-hidden="true">🌱</span>
        <span><strong>Welcome.</strong> Start with your first check-in.</span>
        <span style={ctaArrowStyle}>→</span>
      </Link>
    );
  }

  const last = new Date(lastEntryDate);
  const now = new Date();
  // Use local midnight-to-midnight day diff so "today" is consistent
  const lastMidnight = new Date(last.getFullYear(), last.getMonth(), last.getDate()).getTime();
  const nowMidnight  = new Date(now.getFullYear(),  now.getMonth(),  now.getDate()).getTime();
  const days = Math.max(0, Math.round((nowMidnight - lastMidnight) / _msPerDay));
  const tone = _toneFor(days);

  const relative = formatRelativeDays(days);
  const message  = days === 0
    ? 'You have already checked in today. Nicely done.'
    : `Last check-in ${relative}. Ready for another?`;
  const icon = days === 0 ? '✓' : days <= 2 ? '✨' : days <= 7 ? '🕊' : '🌿';

  // When the user has checked in today, the CTA is a soft "log another"
  // option rather than the primary prompt. Otherwise the pill IS the CTA.
  if (days === 0) {
    return (
      <div style={{ ...pillStyle, background: tone.bg, color: tone.fg, borderLeft: `3px solid ${tone.accent}`, cursor: 'default' }}>
        <span aria-hidden="true">{icon}</span>
        <span>{message}</span>
        <Link to="/mood-tracker" style={{ ...secondaryLinkStyle, color: tone.accent }}>Log another</Link>
      </div>
    );
  }

  return (
    <Link to="/mood-tracker" style={{ ...pillStyle, background: tone.bg, color: tone.fg, borderLeft: `3px solid ${tone.accent}` }}>
      <span aria-hidden="true">{icon}</span>
      <span>{message}</span>
      <span style={ctaArrowStyle}>→</span>
    </Link>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────

const pillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--spacing-sm)',
  padding: '8px 14px 8px 12px',
  borderRadius: 'var(--radius-full, 999px)',
  textDecoration: 'none',
  fontSize: '0.92em',
  fontWeight: 500,
  marginTop: 'var(--spacing-sm)',
  transition: 'transform 120ms ease, background 120ms ease',
  maxWidth: '100%',
};

const ctaArrowStyle = {
  marginLeft: 4,
  fontWeight: 700,
  opacity: 0.7,
};

const secondaryLinkStyle = {
  marginLeft: 'var(--spacing-sm)',
  fontWeight: 600,
  fontSize: '0.85em',
  textDecoration: 'underline',
};

export default LastCheckInPill;
