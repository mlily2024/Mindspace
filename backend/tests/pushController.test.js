/**
 * Tests for pushController — subscribe / unsubscribe / vapid-public-key.
 */

const pushController = require('../src/controllers/pushController');
const PushSubscription = require('../src/models/PushSubscription');

jest.mock('../src/models/PushSubscription', () => ({
  upsert:           jest.fn(),
  deleteByEndpoint: jest.fn()
}));

const makeReq = (overrides = {}) => ({
  user: { userId: 'user-1' },
  body: {},
  query: {},
  get: jest.fn().mockReturnValue('test-user-agent'),
  ...overrides
});

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.VAPID_PUBLIC_KEY;
});

describe('pushController', () => {

  describe('subscribe', () => {
    it('returns 400 when endpoint is missing', async () => {
      const req = makeReq({ body: { keys: { p256dh: 'a', auth: 'b' } } });
      const res = makeRes();
      const next = jest.fn();
      await pushController.subscribe(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
      expect(PushSubscription.upsert).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 when keys are missing', async () => {
      const req = makeReq({ body: { endpoint: 'https://push/x' } });
      const res = makeRes();
      await pushController.subscribe(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when keys.p256dh is missing', async () => {
      const req = makeReq({ body: { endpoint: 'https://push/x', keys: { auth: 'b' } } });
      const res = makeRes();
      await pushController.subscribe(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('upserts and returns the subscription id on a valid payload', async () => {
      PushSubscription.upsert.mockResolvedValue({ subscription_id: 'sub-42' });
      const req = makeReq({ body: {
        endpoint: 'https://push.example.com/abc',
        keys: { p256dh: 'p', auth: 'a' }
      } });
      const res = makeRes();
      await pushController.subscribe(req, res, jest.fn());
      expect(PushSubscription.upsert).toHaveBeenCalledWith('user-1', {
        endpoint:  'https://push.example.com/abc',
        p256dhKey: 'p',
        authKey:   'a',
        userAgent: 'test-user-agent'
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { subscriptionId: 'sub-42' }
      });
    });

    it('passes upsert errors to next()', async () => {
      const err = new Error('db down');
      PushSubscription.upsert.mockRejectedValue(err);
      const req = makeReq({ body: { endpoint: 'https://push/x', keys: { p256dh: 'p', auth: 'a' } } });
      const res = makeRes();
      const next = jest.fn();
      await pushController.subscribe(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('unsubscribe', () => {
    it('returns 400 when endpoint is missing', async () => {
      const req = makeReq({ body: {}, query: {} });
      const res = makeRes();
      await pushController.unsubscribe(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('removes the endpoint when provided in body', async () => {
      PushSubscription.deleteByEndpoint.mockResolvedValue(1);
      const req = makeReq({ body: { endpoint: 'https://push/x' } });
      const res = makeRes();
      await pushController.unsubscribe(req, res, jest.fn());
      expect(PushSubscription.deleteByEndpoint).toHaveBeenCalledWith('user-1', 'https://push/x');
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { removed: 1 } });
    });

    it('accepts the endpoint as a query parameter as well', async () => {
      PushSubscription.deleteByEndpoint.mockResolvedValue(1);
      const req = makeReq({ body: {}, query: { endpoint: 'https://push/y' } });
      const res = makeRes();
      await pushController.unsubscribe(req, res, jest.fn());
      expect(PushSubscription.deleteByEndpoint).toHaveBeenCalledWith('user-1', 'https://push/y');
    });
  });

  describe('vapidPublicKey', () => {
    it('returns the env key when set', () => {
      process.env.VAPID_PUBLIC_KEY = 'BC-test-public-key';
      const res = makeRes();
      pushController.vapidPublicKey(makeReq(), res);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { publicKey: 'BC-test-public-key' }
      });
    });

    it('returns null when no key is configured (graceful for unconfigured deployments)', () => {
      const res = makeRes();
      pushController.vapidPublicKey(makeReq(), res);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { publicKey: null }
      });
    });
  });
});
