import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import LoadErrorBanner from '../components/LoadErrorBanner';
import { journalAPI } from '../services/api';
import { unwrapForRead } from '../services/journalEntryE2EE';
import { getPromptById } from '../data/journalPrompts';

/**
 * JournalHistory — list of past journal entries.
 *
 * The Journal save flow shipped real persistence in commit c54347f but
 * had no read surface; users could write entries and immediately lose
 * sight of them. This page is the J1 enhancement from
 * `[[mindspace-feature-enhancement-audit]]` and closes that gap.
 *
 * Privacy behaviour mirrors `MoodCalendar`:
 *   - Loads entries via journalAPI.getAll (server returns opaque blobs
 *     for E2EE rows, plaintext otherwise)
 *   - Decrypts client-side via journalEntryE2EE.unwrapForRead
 *   - Locked entries (master key not cached) render as
 *     "🔒 End-to-end encrypted. Unlock from the Dashboard prompt to read."
 *     — never surface gibberish ciphertext to the user
 *
 * Layout: list view by default; click a row to expand inline. Each row
 * shows date, prompt category, mood-before → mood-after, and a preview.
 */

const PAGE_SIZE = 30;

const JournalHistory = () => {
  const navigate = useNavigate();
  // idle | loading | ready | error
  const [phase, setPhase] = useState('loading');
  const [entries, setEntries] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setPhase('loading');
    try {
      const res = await journalAPI.getAll({ limit: PAGE_SIZE });
      const raw = (res.data && res.data.entries) || res.entries || [];
      // Decrypt every entry in parallel; unwrapForRead is graceful
      const decrypted = await Promise.all(
        raw.map(async (entry) => {
          const { plaintextResponse, plaintextFollowUps, decrypted: ok } =
            await unwrapForRead(entry);
          return {
            ...entry,
            _plain_response:    plaintextResponse,
            _plain_follow_ups:  plaintextFollowUps,
            _locked:            entry.is_e2ee_encrypted && !ok,
          };
        })
      );
      setEntries(decrypted);
      setPhase('ready');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[JournalHistory] load failed', e);
      setPhase('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (entryId) => {
    if (!window.confirm('Delete this journal entry permanently?')) return;
    setDeletingId(entryId);
    try {
      await journalAPI.delete(entryId);
      setEntries((prev) => prev.filter((e) => e.entry_id !== entryId));
      if (expandedId === entryId) setExpandedId(null);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[JournalHistory] delete failed', e);
      window.alert('Could not delete that entry. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={pageStyle}>
      <Navigation />
      <main style={containerStyle}>
        <div style={headerRowStyle}>
          <div>
            <h1 style={titleStyle}>📝 Journal History</h1>
            <p style={subtitleStyle}>Your past reflections. Newest first.</p>
          </div>
          <Link to="/journal" style={ctaButtonStyle}>+ New entry</Link>
        </div>

        {phase === 'loading' && (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xxl)' }}>
            <div className="spinner" aria-label="Loading entries" />
          </div>
        )}

        {phase === 'error' && <LoadErrorBanner onRetry={load} />}

        {phase === 'ready' && entries.length === 0 && (
          <EmptyState onStart={() => navigate('/journal')} />
        )}

        {phase === 'ready' && entries.length > 0 && (
          <ul style={listStyle}>
            {entries.map((entry) => (
              <EntryRow
                key={entry.entry_id}
                entry={entry}
                expanded={expandedId === entry.entry_id}
                onToggle={() =>
                  setExpandedId(expandedId === entry.entry_id ? null : entry.entry_id)
                }
                onDelete={() => handleDelete(entry.entry_id)}
                deleting={deletingId === entry.entry_id}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};

// ─── EntryRow ────────────────────────────────────────────────────────────────

const EntryRow = ({ entry, expanded, onToggle, onDelete, deleting }) => {
  const prompt = getPromptById(entry.prompt_id);
  const date = entry.created_at ? new Date(entry.created_at) : null;
  const dateLabel = date
    ? date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const timeLabel = date ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
  const moodDelta = entry.mood_before != null && entry.mood_after != null
    ? entry.mood_after - entry.mood_before
    : null;

  const preview = (() => {
    if (entry._locked) return '🔒 End-to-end encrypted. Unlock from the Dashboard prompt to read.';
    const text = entry._plain_response || '';
    return text.length > 140 ? text.slice(0, 140).trim() + '…' : (text || '(no response written)');
  })();

  return (
    <li style={{ ...rowStyle, borderLeftColor: prompt.color }}>
      <button
        type="button"
        onClick={onToggle}
        style={rowButtonStyle}
        aria-expanded={expanded}
      >
        <div style={rowTopStyle}>
          <span style={categoryStyle}>
            <span aria-hidden="true">{prompt.emoji}</span> {prompt.category}
          </span>
          <span style={dateStyle}>{dateLabel} · {timeLabel}</span>
        </div>
        <div style={previewStyle}>{preview}</div>
        {moodDelta !== null && (
          <div style={moodRowStyle}>
            <span>Mood before {entry.mood_before}/10</span>
            <span style={moodDeltaStyle(moodDelta)}>
              {moodDelta > 0 ? '↑' : moodDelta < 0 ? '↓' : '→'} {Math.abs(moodDelta) || 'no change'}
            </span>
            <span>after {entry.mood_after}/10</span>
          </div>
        )}
      </button>

      {expanded && <ExpandedDetail entry={entry} prompt={prompt} onDelete={onDelete} deleting={deleting} />}
    </li>
  );
};

const ExpandedDetail = ({ entry, prompt, onDelete, deleting }) => {
  const followUps = (() => {
    if (entry._locked) return [];
    const raw = entry._plain_follow_ups;
    if (!raw) return [];
    try { return JSON.parse(raw); }
    catch (_) { return []; }
  })();

  return (
    <div style={detailStyle}>
      {prompt.text && (
        <div style={promptBlockStyle}>
          <strong style={{ color: prompt.color }}>Prompt:</strong>
          <p style={{ margin: '4px 0 0 0' }}>{prompt.text}</p>
        </div>
      )}
      {entry._locked ? (
        <p style={lockedStyle}>🔒 End-to-end encrypted. Unlock from the Dashboard prompt to read this entry.</p>
      ) : (
        <>
          <div style={responseBlockStyle}>
            <strong>Your reflection:</strong>
            <p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap' }}>
              {entry._plain_response || '(no response written)'}
            </p>
          </div>
          {followUps.length > 0 && (
            <div style={followUpsBlockStyle}>
              <strong>Follow-up reflections:</strong>
              <ul style={{ margin: '6px 0 0 0', paddingLeft: 'var(--spacing-lg)' }}>
                {followUps.map((fu, i) => (
                  <li key={i} style={{ marginBottom: 4, whiteSpace: 'pre-wrap' }}>{fu}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <div style={actionRowStyle}>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          style={deleteButtonStyle(deleting)}
        >
          {deleting ? 'Deleting…' : '🗑 Delete this entry'}
        </button>
      </div>
    </div>
  );
};

// ─── EmptyState ──────────────────────────────────────────────────────────────

const EmptyState = ({ onStart }) => (
  <div style={emptyStateStyle}>
    <div style={{ fontSize: '3.5rem', marginBottom: 'var(--spacing-md)' }}>🌱</div>
    <h2 style={{ margin: '0 0 var(--spacing-sm) 0' }}>No journal entries yet</h2>
    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
      A few minutes of guided reflection can help you make sense of what you are feeling. Your entries
      are stored privately, and end-to-end encrypted when you have unlocked your master key.
    </p>
    <button type="button" onClick={onStart} style={primaryButtonStyle}>
      Start your first entry
    </button>
  </div>
);

// ─── Styles ──────────────────────────────────────────────────────────────────

const pageStyle = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, var(--background) 0%, var(--primary-light) 100%)',
};
const containerStyle = {
  maxWidth: 760, margin: '0 auto',
  padding: 'var(--spacing-lg) var(--spacing-md)',
};
const headerRowStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  marginBottom: 'var(--spacing-lg)', flexWrap: 'wrap', gap: 'var(--spacing-md)',
};
const titleStyle = { margin: 0, fontFamily: 'var(--font-family-heading)' };
const subtitleStyle = { margin: '4px 0 0 0', color: 'var(--text-secondary)' };
const ctaButtonStyle = {
  padding: '10px 18px',
  background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))',
  color: 'white', borderRadius: 'var(--radius-lg)', textDecoration: 'none', fontWeight: 600,
};

const listStyle = { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' };

const rowStyle = {
  background: 'var(--surface, #fff)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border, #e2e8f0)',
  borderLeft: '4px solid var(--border)',
  overflow: 'hidden',
};
const rowButtonStyle = {
  width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
  padding: 'var(--spacing-md) var(--spacing-lg)', color: 'inherit', font: 'inherit',
};
const rowTopStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  gap: 'var(--spacing-md)', marginBottom: 6, flexWrap: 'wrap',
};
const categoryStyle = { fontWeight: 600 };
const dateStyle = { color: 'var(--text-secondary)', fontSize: '0.88em' };
const previewStyle = { color: 'var(--text-primary)', fontSize: '0.95em', lineHeight: 1.5 };
const moodRowStyle = {
  marginTop: 8, display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
  fontSize: '0.85em', color: 'var(--text-secondary)', flexWrap: 'wrap',
};
const moodDeltaStyle = (delta) => ({
  fontWeight: 700,
  color: delta > 0 ? '#38a169' : delta < 0 ? '#dd6b20' : '#718096',
});

const detailStyle = {
  padding: 'var(--spacing-md) var(--spacing-lg) var(--spacing-lg) var(--spacing-lg)',
  borderTop: '1px solid var(--border, #e2e8f0)',
  background: 'var(--background, #fafafa)',
};
const promptBlockStyle = {
  marginBottom: 'var(--spacing-md)',
  fontStyle: 'italic', color: 'var(--text-secondary)',
};
const responseBlockStyle = { marginBottom: 'var(--spacing-md)' };
const followUpsBlockStyle = { marginBottom: 'var(--spacing-md)' };
const lockedStyle = {
  margin: 0, padding: 'var(--spacing-md)',
  background: 'var(--surface)', borderRadius: 'var(--radius-md)',
  border: '1px dashed var(--border)', fontStyle: 'italic', color: 'var(--text-secondary)',
};
const actionRowStyle = { display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--spacing-sm)' };
const deleteButtonStyle = (deleting) => ({
  padding: '6px 14px',
  background: 'none', border: '1px solid #c53030', color: '#c53030',
  borderRadius: 'var(--radius-md)', cursor: deleting ? 'wait' : 'pointer',
  opacity: deleting ? 0.6 : 1, fontWeight: 500,
});

const emptyStateStyle = {
  textAlign: 'center', padding: 'var(--spacing-xxl)',
  background: 'var(--surface, #fff)', borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border)',
};
const primaryButtonStyle = {
  padding: '10px 22px',
  background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))',
  color: 'white', border: 'none', borderRadius: 'var(--radius-lg)',
  cursor: 'pointer', fontWeight: 600, fontSize: '1em',
};

export default JournalHistory;
