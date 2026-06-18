import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { assessmentsAPI } from '../services/api';

/**
 * ScreeningDuePill — Dashboard nudge to take a clinical screening
 * that has passed its recommended frequency.
 *
 * Reads /api/assessments/due (shipped 2026-06-18 in commit 0d9609e).
 * The backend computes "due" against recommendedFrequencyDays for each
 * of the five validated instruments (PHQ-9, GAD-7, PSS-4, ISI, WEMWBS).
 *
 * Renders nothing in three cases:
 *   - Initial fetch in flight
 *   - API failure (we never want a broken screening service to clutter
 *     the Dashboard with an error pill)
 *   - count === 0 (nothing due — no nudge)
 *
 * Sibling to LastCheckInPill (D1). Same compact format, different tone
 * — soft mint / sage rather than amber so the user can distinguish "you
 * have a check-in waiting" from "you have a screening waiting" at a
 * glance, without either feeling like a demand.
 */
const ScreeningDuePill = () => {
  const [due, setDue] = useState(null);

  useEffect(() => {
    let cancelled = false;
    assessmentsAPI.getDue()
      .then(res => {
        if (cancelled) return;
        // Axios shape: { data: { success, data: { due, count } } }
        // Tolerate either nesting for resilience.
        const payload = res?.data?.data || res?.data || {};
        setDue({
          count: payload.count ?? (payload.due?.length || 0),
          items: payload.due || [],
        });
      })
      .catch(() => {
        if (cancelled) return;
        setDue({ count: 0, items: [] });
      });
    return () => { cancelled = true; };
  }, []);

  if (!due || due.count === 0) return null;

  const label = due.count === 1
    ? `1 screening due — ${due.items[0].name}`
    : `${due.count} screenings due`;

  return (
    <Link to="/assessments" style={pillStyle}>
      <span aria-hidden="true">📋</span>
      <span>{label}</span>
      <span style={ctaArrowStyle}>→</span>
    </Link>
  );
};

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
  marginLeft: 'var(--spacing-sm)',
  background: 'rgba(168, 197, 168, 0.22)',
  color: '#1f5132',
  borderLeft: '3px solid #5a9a5a',
  transition: 'transform 120ms ease, background 120ms ease',
  maxWidth: '100%',
};

const ctaArrowStyle = {
  marginLeft: 4,
  fontWeight: 700,
  opacity: 0.7,
};

export default ScreeningDuePill;
