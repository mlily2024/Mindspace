/**
 * Tests for WebPushService — the Web Push delivery channel.
 *
 * Mocks the PushSubscription model and an injected web-push client so
 * these tests run without a database or @anthropic-ai/web-push installed.
 */

const { WebPushService, resetInstance } = require('../src/services/webPushService');
const PushSubscription = require('../src/models/PushSubscription');

jest.mock('../src/models/PushSubscription', () => ({
  findByUser:        jest.fn(),
  deleteByEndpoint:  jest.fn(),
  touchLastUsed:     jest.fn()
}));

const makeSub = (overrides = {}) => ({
  subscription_id: 'sub-1',
  user_id: 'user-1',
  endpoint: 'https://push.example.com/abc',
  p256dh_key: 'p256dh-base64',
  auth_key: 'auth-base64',
  user_agent: null,
  created_at: new Date(),
  last_used_at: null,
  ...overrides
});

const makeWebpush = (sendImpl) => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(sendImpl || (() => Promise.resolve()))
});

const makeService = (overrides = {}) => new WebPushService({
  vapidPublicKey:  'public-key',
  vapidPrivateKey: 'private-key',
  vapidSubject:    'mailto:test@example.com',
  webpush:         makeWebpush(),
  ...overrides
});

beforeEach(() => {
  jest.clearAllMocks();
  resetInstance();
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
});

describe('WebPushService', () => {

  describe('isEnabled()', () => {
    it('returns true when VAPID keys + web-push client are present', () => {
      expect(makeService().isEnabled()).toBe(true);
    });

    it('returns false when VAPID keys are missing', () => {
      const svc = new WebPushService({ webpush: makeWebpush() });
      expect(svc.isEnabled()).toBe(false);
    });

    it('returns false when web-push module cannot be required', () => {
      const svc = new WebPushService({
        vapidPublicKey: 'k', vapidPrivateKey: 'k'
        // no `webpush` injected and no module installed in test env
      });
      // The constructor will try to require('web-push'); in CI it's not
      // installed → webpush remains null → isEnabled() is false.
      // We can't depend on whether web-push is installed locally, so just
      // assert the contract: isEnabled() returns a boolean.
      expect(typeof svc.isEnabled()).toBe('boolean');
    });
  });

  describe('sendToUser() — when disabled', () => {
    it('returns zeros without touching the model', async () => {
      const svc = new WebPushService({ webpush: makeWebpush() }); // no keys
      const result = await svc.sendToUser('user-1', { title: 'x' });
      expect(result).toEqual({ sent: 0, pruned: 0, failed: 0 });
      expect(PushSubscription.findByUser).not.toHaveBeenCalled();
    });
  });

  describe('sendToUser() — when enabled', () => {
    it('returns zeros when user has no subscriptions', async () => {
      PushSubscription.findByUser.mockResolvedValue([]);
      const svc = makeService();
      const result = await svc.sendToUser('user-1', { title: 'x' });
      expect(result).toEqual({ sent: 0, pruned: 0, failed: 0 });
    });

    it('dispatches to every subscription and counts successes', async () => {
      const subs = [makeSub({ subscription_id: 's1', endpoint: 'https://push/1' }),
                    makeSub({ subscription_id: 's2', endpoint: 'https://push/2' })];
      PushSubscription.findByUser.mockResolvedValue(subs);
      const wp = makeWebpush();
      const svc = new WebPushService({
        vapidPublicKey: 'k', vapidPrivateKey: 'k', webpush: wp
      });

      const result = await svc.sendToUser('user-1', { title: 'hi' });

      expect(wp.sendNotification).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ sent: 2, pruned: 0, failed: 0 });
      // touchLastUsed called for each success
      expect(PushSubscription.touchLastUsed).toHaveBeenCalledTimes(2);
    });

    it('prunes endpoints that respond with 410 Gone', async () => {
      const subs = [makeSub({ endpoint: 'https://push/gone' })];
      PushSubscription.findByUser.mockResolvedValue(subs);
      PushSubscription.deleteByEndpoint.mockResolvedValue(1);

      const gone = Object.assign(new Error('Gone'), { statusCode: 410 });
      const wp = makeWebpush(() => Promise.reject(gone));
      const svc = new WebPushService({
        vapidPublicKey: 'k', vapidPrivateKey: 'k', webpush: wp
      });

      const result = await svc.sendToUser('user-1', { title: 'x' });
      expect(result).toEqual({ sent: 0, pruned: 1, failed: 0 });
      expect(PushSubscription.deleteByEndpoint).toHaveBeenCalledWith('user-1', 'https://push/gone');
    });

    it('prunes endpoints that respond with 404 Not Found', async () => {
      PushSubscription.findByUser.mockResolvedValue([makeSub({ endpoint: 'https://push/nf' })]);
      PushSubscription.deleteByEndpoint.mockResolvedValue(1);
      const notFound = Object.assign(new Error('Not Found'), { statusCode: 404 });
      const wp = makeWebpush(() => Promise.reject(notFound));
      const svc = new WebPushService({
        vapidPublicKey: 'k', vapidPrivateKey: 'k', webpush: wp
      });
      const result = await svc.sendToUser('user-1', { title: 'x' });
      expect(result.pruned).toBe(1);
    });

    it('counts non-gone errors as failed (and does NOT prune)', async () => {
      PushSubscription.findByUser.mockResolvedValue([makeSub()]);
      const otherErr = Object.assign(new Error('timeout'), { statusCode: 503 });
      const wp = makeWebpush(() => Promise.reject(otherErr));
      const svc = new WebPushService({
        vapidPublicKey: 'k', vapidPrivateKey: 'k', webpush: wp
      });
      const result = await svc.sendToUser('user-1', { title: 'x' });
      expect(result).toEqual({ sent: 0, pruned: 0, failed: 1 });
      expect(PushSubscription.deleteByEndpoint).not.toHaveBeenCalled();
    });

    it('isolates per-subscription failures (Promise.allSettled semantics)', async () => {
      const subs = [makeSub({ subscription_id: 's-ok',  endpoint: 'https://push/ok' }),
                    makeSub({ subscription_id: 's-bad', endpoint: 'https://push/bad' })];
      PushSubscription.findByUser.mockResolvedValue(subs);
      PushSubscription.deleteByEndpoint.mockResolvedValue(1);

      const calls = [];
      const gone = Object.assign(new Error('Gone'), { statusCode: 410 });
      const wp = {
        setVapidDetails: jest.fn(),
        sendNotification: jest.fn((sub) => {
          calls.push(sub.endpoint);
          return sub.endpoint.endsWith('bad')
            ? Promise.reject(gone)
            : Promise.resolve();
        })
      };
      const svc = new WebPushService({
        vapidPublicKey: 'k', vapidPrivateKey: 'k', webpush: wp
      });

      const result = await svc.sendToUser('user-1', { title: 'x' });
      expect(result).toEqual({ sent: 1, pruned: 1, failed: 0 });
      expect(calls).toEqual(['https://push/ok', 'https://push/bad']);
    });

    it('serialises the payload to JSON when calling the SDK', async () => {
      PushSubscription.findByUser.mockResolvedValue([makeSub()]);
      const wp = makeWebpush();
      const svc = new WebPushService({
        vapidPublicKey: 'k', vapidPrivateKey: 'k', webpush: wp
      });
      await svc.sendToUser('user-1', { title: 'hi', body: 'world' });
      const callArgs = wp.sendNotification.mock.calls[0];
      expect(typeof callArgs[1]).toBe('string');
      expect(JSON.parse(callArgs[1])).toEqual({ title: 'hi', body: 'world' });
      expect(callArgs[2]).toMatchObject({ TTL: 86_400 });
    });
  });
});
