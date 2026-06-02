# ADR-0002 — Web Push as an additive delivery channel

- **Status:** Accepted
- **Date:** 2026-06-02
- **Affects:** `backend/src/services/notificationService.js`, `webPushService.js`, `frontend/public/service-worker.js`, `frontend/src/services/pushService.js`, `push_subscriptions` table

## Context

Notifications inside Mindspace — safety alerts, new insights, peer-support
messages, achievement and streak updates — are dispatched via
`NotificationService.sendToUser(userId, event, data)`, which emits a
Socket.io event scoped to a per-user room.

This works well for online users (the tab is open, Socket.io is connected,
delivery is instant, no permission prompt). It fails for everyone else:

- Tab closed → no Socket.io connection → safety alerts not delivered until the
  user re-opens the app, which could be hours later.
- Mobile context where the OS aggressively backgrounds browser tabs.
- The peer-message and crisis-alert flows are the most safety-relevant and
  most affected by this gap.

We needed offline-capable delivery without disrupting the existing online
path, and without adding a third-party vendor.

## Decision

Add the standards-based **Web Push** protocol as a **second** delivery
channel alongside (not replacing) Socket.io.

Architecture:

```
NotificationService.sendToUser(userId, event, data)
   ├──▶  Socket.io     io.to(`user:${userId}`).emit(event, payload)
   │                   ─ instant delivery for online users
   │                   ─ no permission prompt
   │                   ─ no per-user storage
   │
   └──▶  WebPushService.sendToUser(userId, pushPayload)
                       ─ delivered to OS notification tray
                       ─ works when tab is closed
                       ─ requires browser permission grant + VAPID
                       ─ fire-and-forget; never blocks Socket.io
```

`WebPushService` is implemented over the `web-push` npm library (server-side
VAPID-authenticated dispatch). Per-user browser endpoints live in the
`push_subscriptions` table with `UNIQUE(user_id, endpoint)`. The
frontend opts in via Settings → Preferences → "Enable push notifications",
which requests browser permission, registers `/service-worker.js`,
subscribes via `PushManager`, and POSTs the subscription to
`POST /api/push/subscribe`.

Properties of the implementation:

- **Disabled gracefully** when VAPID keys are not configured: `isEnabled()`
  returns false, `sendToUser` no-ops with a logged warning. Socket.io
  continues to work unaffected.
- **Per-subscription failure isolation** via `Promise.allSettled` — one bad
  endpoint never blocks delivery to a user's other devices.
- **Automatic pruning** of stale endpoints — when a push service returns
  HTTP 404 or 410 (browser uninstalled the PWA / user revoked permission),
  the offending row is deleted from `push_subscriptions`. No manual cleanup
  required.
- **Best-effort from the caller's perspective** — `sendToUser` returns
  immediately after the Socket.io emit; the Web Push fan-out is awaited
  outside the return path. A network hiccup in Web Push never blocks the
  in-app channel or the HTTP response.
- **VAPID keys are per-deployment**, generated once via
  `backend/scripts/generate-vapid.js`. The frontend fetches the public key
  at service-worker registration time via the unauthenticated
  `GET /api/push/vapid-public-key`.

The frontend permission prompt is **deferred** — it only fires from the
explicit click handler in Settings, never on page load, in line with modern
permission-request UX guidance.

## Consequences

### Positive

- **Zero regression for online users.** They keep receiving instant Socket.io
  updates; nothing changes in their experience.
- **Offline users now get OS-level alerts.** The safety-critical flows
  (crisis alerts, escalation notifications) reach users even when the tab is
  closed.
- **No third-party dependency** beyond the open `web-push` library and the
  browsers' standard push services. No vendor lock-in, no per-message cost,
  no PII shared with a notification vendor.
- **Stale-subscription drift solves itself.** Browsers naturally invalidate
  endpoints over time (uninstall, revocation, browser-data clear); the
  auto-prune keeps the table clean without any ops work.
- **Per-user opt-in by design** — no notification can fire to a user who
  hasn't explicitly granted permission via the Settings toggle.

### Negative

- **Operator must generate VAPID keys and apply the new migration.** One-time
  setup, scripted (`generate-vapid.js`, `run-migration.js`). Without it the
  channel is silently inert.
- **iOS Safari** doesn't support Web Push for non-installed PWAs (until
  iOS 16.4+, and even then only for installed PWAs). Acceptable — iOS users
  fall back to the existing Socket.io behaviour when active.
- **Adds a second migration to apply.** Mitigated by the
  `scripts/run-migration.js` cross-platform runner.

### Neutral

- The payload format (`{ title, body, data: { event, ... } }`) is chosen by
  `NotificationService._titleForEvent` and `_bodyForEvent` — a small mapping
  the service worker renders generically. Per-event icon and action
  customisation is future work.

## Alternatives considered

1. **Replace Socket.io entirely with Web Push.** Rejected — Web Push has
   higher latency (browser polls the push service), requires a permission
   prompt, and would break the in-app real-time experience for peer chat
   and live notifications.
2. **Use a hosted push service (OneSignal, Firebase Cloud Messaging, AWS
   SNS).** Rejected — adds vendor lock-in, monthly cost, and a third party
   that sees user identifiers. Web Push over VAPID achieves the same outcome
   without those costs.
3. **Email notifications as the offline fallback.** Considered as a *future*
   third channel (especially for digest/daily summaries). Not in scope for
   this change — email is slower, has different consent expectations, and is
   strictly worse for the safety-alert use case where latency matters.
4. **Add Web Push as a separate `sendPushToUser` method.** Rejected — would
   force every existing call site (`sendSafetyAlert`, `sendNewInsight`,
   `sendStreakUpdate`, etc.) to be updated. Hooking inside `sendToUser`
   gives every helper Web Push automatically with zero call-site changes.
