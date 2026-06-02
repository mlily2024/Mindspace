/**
 * sentimentService — privacy-preserving on-device sentiment analysis.
 *
 * Runs the entire ML pipeline in the browser via Transformers.js. The
 * user's journal / notes text never leaves the device; only the
 * derived score, label, confidence, model id, and a SHA-256 of the
 * text are sent to the server (see ADR-0006).
 *
 * Design choices documented in ADR-0006:
 *   - Model: distilbert-base-uncased-finetuned-sst-2-english (Xenova
 *     pre-quantised int8 build, ~67 MB on first load). Loaded once
 *     per session and cached by the browser; subsequent inferences
 *     are ~10–80 ms on modern hardware.
 *   - Network: model weights download from the Hugging Face CDN on
 *     first call. After that, useBrowserCache:true keeps them local.
 *   - Failure mode: if the model fails to load (no network, blocked
 *     CDN), getReady() rejects — callers should fall back to
 *     server-less / opt-out rather than ever send plaintext.
 *
 * Public API:
 *   analyseOnDevice(text)        → { label, score, confidence, model_id,
 *                                    text_length, text_hash, inference_ms }
 *   submitToServer(result, api, [moodEntryId])  → server response
 *   getReady()                    → resolves when the model is loaded
 *   isReady()                     → boolean
 */

import { pipeline, env } from '@xenova/transformers';

// Configure the runtime BEFORE any pipeline() call.
//   allowLocalModels:false  — don't try to load from a same-origin path
//   useBrowserCache:true    — IndexedDB-cache the weights after first load
env.allowLocalModels = false;
env.useBrowserCache  = true;

// Pre-quantised int8 build by Xenova — ~67 MB first download, fast
// inference once cached. SST-2 head returns POSITIVE / NEGATIVE with
// a probability score. We map NEGATIVE → signed score -p, POSITIVE → +p
// and additionally surface a 'neutral' label when confidence is low
// (so callers don't have to invent a threshold).
const MODEL_ID = 'Xenova/distilbert-base-uncased-finetuned-sst-2-english';
const NEUTRAL_BAND = 0.60;   // probability < 0.60 ⇒ treat as 'neutral'

let _classifierPromise = null;
let _ready = false;

/** Lazy-loaded singleton — first call starts the model download. */
const _getClassifier = () => {
  if (_classifierPromise) return _classifierPromise;
  _classifierPromise = pipeline('sentiment-analysis', MODEL_ID)
    .then((cls) => { _ready = true; return cls; })
    .catch((err) => { _classifierPromise = null; throw err; });
  return _classifierPromise;
};

/** Prime the model. Call early (e.g. on Settings → toggle on) so the
 *  first real analysis is fast. */
export const getReady = async () => { await _getClassifier(); };

export const isReady = () => _ready;

/** SHA-256 hex via the browser's SubtleCrypto. */
const _sha256Hex = async (text) => {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
};

/**
 * Run the on-device pipeline on `text`. Returns a flat object ready to
 * POST to /api/mood-sentiments. The plaintext is never returned to the
 * caller in this object — only its length and SHA-256.
 *
 * @param {string} text  the journal / notes content to analyse
 * @returns {Promise<Object>}
 *   {
 *     label:        'positive' | 'negative' | 'neutral',
 *     score:        number in [-1, 1] (signed),
 *     confidence:   number in [0, 1],
 *     model_id:     string,
 *     text_length:  number,
 *     text_hash:    64-char SHA-256 hex,
 *     inference_ms: integer (wall-clock on this device)
 *   }
 */
export const analyseOnDevice = async (text) => {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('analyseOnDevice: text must be a non-empty string');
  }
  const classifier = await _getClassifier();

  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const out = await classifier(text);
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  // Transformers.js returns either an array or a single object — normalise.
  const first = Array.isArray(out) ? out[0] : out;
  if (!first || typeof first.label !== 'string' || typeof first.score !== 'number') {
    throw new Error('analyseOnDevice: unexpected classifier output shape');
  }

  const rawLabel = first.label.toUpperCase();          // 'POSITIVE' | 'NEGATIVE'
  const prob     = first.score;                         // P(rawLabel) ∈ [0, 1]
  let label, signedScore;
  if (prob < NEUTRAL_BAND) {
    label       = 'neutral';
    signedScore = 0;
  } else if (rawLabel === 'POSITIVE') {
    label       = 'positive';
    signedScore = prob;
  } else {
    label       = 'negative';
    signedScore = -prob;
  }

  const text_hash = await _sha256Hex(text);

  return {
    label,
    score:        Number(signedScore.toFixed(4)),
    confidence:   Number(prob.toFixed(4)),
    model_id:     MODEL_ID,
    text_length:  text.length,
    text_hash,
    inference_ms: Math.round(t1 - t0)
  };
};

/**
 * POST an analysis result to the backend.
 *
 * @param {Object} result      output of analyseOnDevice()
 * @param {Object} api         axios-like client (e.g. our shared `api` from services/api.js)
 * @param {string} [moodEntryId]
 */
export const submitToServer = (result, api, moodEntryId = null) => {
  return api.post('/mood-sentiments', {
    sentimentScore: result.score,
    sentimentLabel: result.label,
    confidence:     result.confidence,
    modelId:        result.model_id,
    textLength:     result.text_length,
    textHash:       result.text_hash,
    inferenceMs:    result.inference_ms,
    moodEntryId
  });
};

// Exposed for testing.
export const _internal = { MODEL_ID, NEUTRAL_BAND, _sha256Hex };
