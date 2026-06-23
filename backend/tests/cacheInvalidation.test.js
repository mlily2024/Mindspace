/**
 * Tests for cacheInvalidation (F.7, ADR-0020) — cross-instance invalidation fan-out.
 * A fake Redis client is injected, so no ioredis or live server is needed.
 */
jest.mock('../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { init, CHANNEL } = require('../src/services/cacheInvalidation');

function makeFake() {
  let messageHandler = null;
  return {
    subscribe: jest.fn(() => Promise.resolve(1)),
    on: jest.fn((ev, h) => { if (ev === 'message') messageHandler = h; }),
    publish: jest.fn(() => Promise.resolve(1)),
    quit: jest.fn(() => Promise.resolve()),
    emit: (ch, raw) => messageHandler && messageHandler(ch, raw),
  };
}

describe('cacheInvalidation.init — default (single instance)', () => {
  it('is a no-op when REDIS_URL is absent and never builds a client', () => {
    const createClient = jest.fn();
    const onInvalidate = jest.fn();
    const backend = init(onInvalidate, { redisUrl: undefined, createClient });
    expect(backend.enabled).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
    expect(() => backend.publish({ tier: 'short', op: 'clear' })).not.toThrow();
  });

  it('degrades safely to single-instance if the client cannot be built (ioredis missing)', () => {
    const backend = init(jest.fn(), {
      redisUrl: 'redis://x',
      createClient: () => { throw new Error('Cannot find module ioredis'); },
    });
    expect(backend.enabled).toBe(false);
  });
});

describe('cacheInvalidation.init — enabled', () => {
  it('subscribes to the channel and reports enabled with an instance id', () => {
    const fake = makeFake();
    const backend = init(jest.fn(), { redisUrl: 'redis://x', createClient: () => fake });
    expect(backend.enabled).toBe(true);
    expect(typeof backend.instanceId).toBe('string');
    expect(fake.subscribe).toHaveBeenCalledWith(CHANNEL);
  });

  it('publish tags the message with our instance id and the payload', () => {
    const fake = makeFake();
    const backend = init(jest.fn(), { redisUrl: 'redis://x', createClient: () => fake });
    backend.publish({ tier: 'short', op: 'delByUser', userId: 'u1' });
    expect(fake.publish).toHaveBeenCalledTimes(1);
    const [channel, raw] = fake.publish.mock.calls[0];
    expect(channel).toBe(CHANNEL);
    const msg = JSON.parse(raw);
    expect(msg).toMatchObject({ tier: 'short', op: 'delByUser', userId: 'u1', instanceId: backend.instanceId });
  });

  it('applies a PEER invalidation (different instance id)', () => {
    const fake = makeFake();
    const onInvalidate = jest.fn();
    init(onInvalidate, { redisUrl: 'redis://x', createClient: () => fake });
    const peer = JSON.stringify({ instanceId: 'someone-else', tier: 'long', op: 'clear' });
    fake.emit(CHANNEL, peer);
    expect(onInvalidate).toHaveBeenCalledWith({ instanceId: 'someone-else', tier: 'long', op: 'clear' });
  });

  it('IGNORES our own echoed message (same instance id) — no invalidation loop', () => {
    const fake = makeFake();
    const onInvalidate = jest.fn();
    const backend = init(onInvalidate, { redisUrl: 'redis://x', createClient: () => fake });
    backend.publish({ tier: 'short', op: 'clear' });
    const ownRaw = fake.publish.mock.calls[0][1];
    fake.emit(CHANNEL, ownRaw);
    expect(onInvalidate).not.toHaveBeenCalled();
  });

  it('ignores other channels and malformed payloads without throwing', () => {
    const fake = makeFake();
    const onInvalidate = jest.fn();
    init(onInvalidate, { redisUrl: 'redis://x', createClient: () => fake });
    fake.emit('some:other:channel', JSON.stringify({ instanceId: 'x', op: 'clear' }));
    fake.emit(CHANNEL, '{not valid json');
    expect(onInvalidate).not.toHaveBeenCalled();
  });
});
