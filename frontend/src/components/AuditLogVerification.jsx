import React, { useState } from 'react';
import { auditAPI } from '../services/api';

/**
 * AuditLogVerification — user-facing controls for the hash-chained AI audit
 * log shipped in ADR-0004. Provides two affordances:
 *   1. "Verify integrity now" — calls GET /api/audit/verify-mine, shows ✓ or ✕
 *   2. "Download my log (JSON)" — calls GET /api/audit/download-mine, saves
 *      the chain so the user can run an independent SHA-256 verifier
 *
 * Phase 1.2 of the privacy-enhancements handover (2026-06-15).
 * Lives in the Privacy & Data tab, below the privacy nutrition label.
 */
const AuditLogVerification = () => {
  const [verifyResult,  setVerifyResult]  = useState(null);  // null | {ok, count, ...} | {error}
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  const handleVerify = async () => {
    setVerifyLoading(true);
    setVerifyResult(null);
    try {
      const res = await auditAPI.verifyMine();
      // axios wraps the body in .data; backend envelopes the chain in {success, data}
      setVerifyResult(res.data && res.data.data ? res.data.data : { error: 'Unexpected response shape' });
    } catch (err) {
      setVerifyResult({ error: (err && err.response && err.response.data && err.response.data.message)
        || (err && err.message)
        || 'Verification request failed' });
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloadLoading(true);
    setDownloadError(null);
    try {
      const res = await auditAPI.downloadMine();
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `mindspace_audit_chain_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setDownloadError((err && err.response && err.response.data && err.response.data.message)
        || (err && err.message)
        || 'Download failed');
    } finally {
      setDownloadLoading(false);
    }
  };

  const renderResult = () => {
    if (!verifyResult) return null;
    if (verifyResult.error) {
      return (
        <div style={resultStyle('error')} role="alert">
          <strong>Verification request failed:</strong> {verifyResult.error}
        </div>
      );
    }
    if (verifyResult.ok) {
      const at = verifyResult.verified_at ? new Date(verifyResult.verified_at).toLocaleString() : '';
      if (verifyResult.count === 0) {
        return (
          <div style={resultStyle('info')}>
            <strong>No conversations on record yet.</strong> Your audit chain is empty.
            It will be populated as soon as you interact with Luna.
            {at && <div style={{ fontSize: '0.85em', marginTop: 4 }}>Checked at {at}.</div>}
          </div>
        );
      }
      return (
        <div style={resultStyle('success')} role="status">
          <strong>✓ All {verifyResult.count.toLocaleString()} records verified as untampered.</strong>
          {at && <div style={{ fontSize: '0.85em', marginTop: 4 }}>Checked at {at}.</div>}
        </div>
      );
    }
    return (
      <div style={resultStyle('error')} role="alert">
        <strong>✕ Tamper detected at record #{verifyResult.brokenAt}.</strong>
        <div style={{ fontSize: '0.9em', marginTop: 6 }}>
          Reason: <code>{verifyResult.reason}</code>.
          Please contact support — this should not happen and is itself the signal that the
          tamper-evidence design is working.
        </div>
      </div>
    );
  };

  return (
    <div
      className="card"
      style={{
        marginBottom: 'var(--spacing-xl)',
        borderLeft: '4px solid var(--primary-color)',
      }}
      aria-labelledby="audit-verify-heading"
    >
      <h2
        id="audit-verify-heading"
        style={{
          marginBottom: 'var(--spacing-sm)',
          display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)'
        }}
      >
        <span aria-hidden="true">🔍</span> Verify your conversation log
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
        Every Luna conversation appends a SHA-256 fingerprint to a per-user hash chain.
        You can verify end-to-end that no record has been altered after the fact, or
        download the chain to run an independent verifier (the canonical hash
        algorithm is published in <code>backend/src/services/aiAuditService.js</code>).
      </p>

      <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', marginBottom: 'var(--spacing-md)' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleVerify}
          disabled={verifyLoading}
        >
          {verifyLoading ? 'Verifying…' : 'Verify integrity now'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={handleDownload}
          disabled={downloadLoading}
          style={{ backgroundColor: 'var(--surface)' }}
        >
          {downloadLoading ? 'Preparing…' : '📥 Download my log (JSON)'}
        </button>
      </div>

      {renderResult()}
      {downloadError && (
        <div style={resultStyle('error')} role="alert">
          <strong>Download failed:</strong> {downloadError}
        </div>
      )}
    </div>
  );
};

const resultStyle = (kind) => ({
  marginTop: 'var(--spacing-sm)',
  padding: 'var(--spacing-md)',
  borderRadius: 'var(--radius-md, 6px)',
  fontSize: 'var(--font-size-small)',
  lineHeight: 1.5,
  ...(kind === 'success' && { background: '#d4edda', color: '#155724', border: '1px solid #c3e6cb' }),
  ...(kind === 'error'   && { background: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb' }),
  ...(kind === 'info'    && { background: '#e2e3e5', color: '#383d41', border: '1px solid #d6d8db' }),
});

export default AuditLogVerification;
