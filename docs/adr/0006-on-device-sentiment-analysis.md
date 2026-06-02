# ADR-0006: On-device sentiment analysis for journal text

**Status:** Accepted (2026-06-02). Frontend architecture shipped;
UI integration tracked as a follow-up.

## Context

Mindspace's journal / notes feature lets users type free-form text
about how they're feeling. To turn that into a useful signal (mood
trend, suggested intervention, dashboard chart) the system needs to
classify the sentiment of each entry.

The default architecture for that classification — send the text to a
server-side endpoint, run it through a cloud model or an LLM — has a
fundamental privacy problem in this domain. The text is the most
sensitive content a user produces in the app: explicit references to
mental state, named people, life events. A server-side analysis pipe
*could* be careful (encryption at rest, short retention, strict ACL),
but the user still has to trust the operator. For a privacy-first
positioning, "trust the operator with your journal" is the wrong
default.

A second architecture — sending the text to a third-party LLM (the
existing Luna provider via Anthropic Claude) — has the same problem
plus a vendor-trust hop. ADR-0001 already constrains LLM use to
opt-in companion chat; bulk sentiment of every journal entry is a
different use case.

## Decision

Sentiment classification of journal / notes text **runs on the user's
own device** via Transformers.js. The server-side surface receives
only the derived numeric outputs:

- `sentimentScore` ∈ [-1, 1] (signed)
- `sentimentLabel` ∈ {positive, negative, neutral}
- `confidence` ∈ [0, 1]
- `modelId` (provenance — which model produced this)
- `textLength` (count of characters only)
- `textHash` (SHA-256 of the text — for client-side de-duplication, irreversible)
- `inferenceMs` (telemetry; user's wall-clock time)

**The plaintext is never transmitted to the server, in any path.**

A new endpoint `POST /api/mood-sentiments` accepts these fields; a
new table `mood_sentiments` stores them; the existing AI audit log
(ADR-0004) records the fact that an on-device sentiment release
happened, attributed to the user.

### Model choice

`Xenova/distilbert-base-uncased-finetuned-sst-2-english`

- **Pre-quantised int8 build** — about 67 MB on first download, then
  cached by the browser (IndexedDB via Transformers.js) for the
  session and across visits.
- **Inference cost on modern hardware** — 10–80 ms per short journal
  entry; well under one second on older devices.
- **Binary head** — POSITIVE / NEGATIVE with probability. The
  service maps probability < 0.60 to a 'neutral' label so callers do
  not have to invent their own threshold and downstream stats are
  stable.

### Architectural fall-back rule

If the model fails to load (no network, blocked CDN, corporate proxy
strips WASM, etc.), the frontend `getReady()` rejects. The caller
**must NOT fall back to sending plaintext to a server endpoint**.
The acceptable fall-back is to disable the feature for that session,
not to undo the privacy guarantee silently.

## What this is NOT

- **Not a clinical sentiment grader.** The model is trained on movie
  reviews (SST-2). The mood signal it produces is a sentiment proxy,
  useful for trends, not a substitute for a validated clinical
  assessment (PHQ-9 / GAD-7 are already in `clinicalAssessmentService`
  for that).
- **Not crisis detection.** The hard-coded UK crisis-keyword filter
  (ADR-0003) runs on Luna text only and is not affected by this
  change. Crisis screening for journal text would be a separate
  privacy-preserving on-device classifier and is deliberately out of
  scope here.
- **Not a generic embedding endpoint.** This release returns a single
  signed score + label. Storing 384-dim sentence embeddings per
  entry was considered and rejected for v1 — embeddings can leak
  more information than a single score, and the storage cost
  compounds.

## Trade-offs accepted

| Cost | Mitigation |
|---|---|
| First-load cost: 67 MB model download. | Triggered lazily on the first opt-in click, not on app load. Cached after first download, so subsequent sessions are instant. Users on metered connections see this only once and only if they explicitly opt in. |
| Inference cost shifts from server CPU to user device. | Modern CPUs handle DistilBERT-int8 in <100 ms per call. Mobile fall-back is to skip sentiment rather than send plaintext — explicit, not silent. |
| The SST-2 movie-review training distribution is not perfectly aligned with journal text. | Documented explicitly above. The endpoint surface includes `confidence` so consumers can filter low-confidence releases. A future fine-tune on mental-health-domain data would slot in behind the same model_id-versioned schema. |
| Text hash is one-way but still leaks a deterministic identifier per text. | A user re-analysing the same text twice produces the same hash. This is intentional (de-duplication) and irreversible (hash → text is computationally infeasible for journal-length inputs). Documented. |
| Server cannot re-run analysis on stored data. | Correct — that's the privacy guarantee. If a model upgrade lands, only entries analysed AFTER the upgrade benefit; older entries keep their old model_id forever. Acceptable trade. |

## Verification

- 17 backend unit tests (`tests/moodSentimentModel.test.js`) cover
  field validation, value-range checks, the "never persist plaintext"
  contract (a stray `text:` key on the input does not surface in the
  INSERT params), and read-path filters (label, limit-clamping,
  summarise day-bound clamping).
- Backend full suite: **213/213 passing across 15 suites**.
- ESLint: 0 issues.
- Migration 010 applied to local DB; schema verified column-by-column.
- Frontend service code-complete with documented public surface;
  in-browser inference smoke test is queued as a follow-up.

## References

- Sanh, V., Debut, L., Chaumond, J. & Wolf, T. (2019). *DistilBERT,
  a distilled version of BERT.* arXiv:1910.01108.
- Socher, R. et al. (2013). *Recursive deep models for semantic
  compositionality over a sentiment treebank.* (SST-2).
- Transformers.js project — https://github.com/xenova/transformers.js
- ADR-0001 (LLM provider abstraction + safety boundary).
- ADR-0004 (Hash-chained AI audit log) — on-device sentiment releases
  are themselves audited via the same machinery.
- ADR-0005 (Differential-privacy cohort aggregates) — companion
  privacy mechanism for cross-user statistics.
