import React from 'react';

/**
 * PrivacyNutritionLabel — at-a-glance summary of the privacy mechanisms
 * shipped in this app. Renders at the top of the Privacy & Data tab.
 *
 * Phase 1.1 of the privacy-enhancements handover (2026-06-15).
 * Pure presentational: no API calls, no state, no side effects.
 *
 * Each row is plain-English. The deeper design lives in:
 *   - README (architecture section, public on GitHub)
 *   - docs/adr/0001..0007 (local-only)
 */

const MECHANISMS = [
  {
    icon: '🔗',
    name: 'Hash-chained AI audit log',
    status: 'active',
    description:
      'Every Luna conversation is stored as a cryptographic fingerprint (SHA-256), ' +
      'not the words themselves. We cannot read your conversations after the fact, ' +
      'and any tampering is detectable by walking the chain.',
  },
  {
    icon: '📊',
    name: 'ε-Differential privacy',
    status: 'active',
    description:
      'Cross-user statistics are mathematically noised (Laplace mechanism) before ' +
      'release, so no aggregate can be inverted to re-identify any single user.',
  },
  {
    icon: '🧠',
    name: 'On-device sentiment analysis',
    status: 'available',
    description:
      'If you turn on sentiment analysis, the classification runs in your browser ' +
      'using a quantised DistilBERT model. Your journal text never leaves your device; ' +
      'only the derived score is sent.',
  },
  {
    icon: '🔒',
    name: 'AES-256-GCM encryption at rest',
    status: 'active',
    description:
      'All private notes are stored using AES-256-GCM authenticated encryption. ' +
      'There is no legacy fallback path: decryption rejects any non-AES-GCM input.',
  },
  {
    icon: '🆘',
    name: 'UK-localised crisis content',
    status: 'active',
    description:
      'If you appear to be in crisis, Luna shows UK-specific helplines (Samaritans, ' +
      'Shout, NHS 111, Papyrus, 999). The list is fixed in code and protected by a ' +
      'regression test that blocks US-number reintroduction.',
  },
  {
    icon: '🛡️',
    name: 'LLM safety filter',
    status: 'active',
    description:
      'Crisis detection runs on your message BEFORE any third-party API call. ' +
      'The LLM never decides whether you are in crisis; rule-based fallback handles ' +
      'any provider unavailability.',
  },
  {
    icon: '🔔',
    name: 'Push subscription isolation',
    status: 'active',
    description:
      'Browser push subscriptions are isolated per-subscription. A failed delivery ' +
      'to one device cannot leak signal about other devices, and stale endpoints are ' +
      'auto-pruned on the next dispatch.',
  },
];

const statusBadgeStyle = (status) => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 'var(--radius-sm, 4px)',
  fontSize: '11px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  ...(status === 'active'
    ? { background: '#d4edda', color: '#155724' }
    : { background: '#d1ecf1', color: '#0c5460' }),
});

const rowStyle = (isLast) => ({
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto',
  gap: 'var(--spacing-md)',
  alignItems: 'start',
  paddingBottom: isLast ? 0 : 'var(--spacing-md)',
  borderBottom: isLast ? 'none' : '1px solid var(--border)',
});

const PrivacyNutritionLabel = () => (
  <div
    className="card"
    style={{
      marginBottom: 'var(--spacing-xl)',
      borderLeft: '4px solid var(--primary-color)',
    }}
    aria-labelledby="privacy-nutrition-heading"
  >
    <h2
      id="privacy-nutrition-heading"
      style={{
        marginBottom: 'var(--spacing-sm)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
      }}
    >
      <span aria-hidden="true">🛡️</span> Privacy mechanisms in this app
    </h2>
    <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
      Plain-English summary of what protects your data. Each mechanism is implemented in code,
      validated by tests on every push, and grounded in a public standard or peer-reviewed paper.
    </p>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      {MECHANISMS.map((m, idx) => (
        <div key={m.name} style={rowStyle(idx === MECHANISMS.length - 1)}>
          <span style={{ fontSize: '1.6em', lineHeight: 1 }} aria-hidden="true">
            {m.icon}
          </span>
          <div>
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>{m.name}</div>
            <div
              style={{
                fontSize: 'var(--font-size-small)',
                color: 'var(--text-secondary)',
                lineHeight: 1.45,
              }}
            >
              {m.description}
            </div>
          </div>
          <span style={statusBadgeStyle(m.status)}>
            {m.status === 'active' ? '✓ Active' : 'ⓘ Opt-in'}
          </span>
        </div>
      ))}
    </div>

    <p
      style={{
        marginTop: 'var(--spacing-lg)',
        paddingTop: 'var(--spacing-md)',
        borderTop: '1px solid var(--border)',
        fontSize: 'var(--font-size-small)',
        color: 'var(--text-secondary)',
      }}
    >
      Read the full architectural design in the{' '}
      <a
        href="https://github.com/mlily2024/Mindspace#architecture--three-composable-privacy-mechanisms"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--primary-color)' }}
      >
        project README on GitHub
      </a>
      .
    </p>
  </div>
);

export default PrivacyNutritionLabel;
