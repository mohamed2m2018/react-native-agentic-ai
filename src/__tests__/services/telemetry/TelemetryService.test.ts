import { TelemetryService } from '../../../services/telemetry/TelemetryService';

jest.mock('../../../services/telemetry/device', () => ({
  getDeviceId: jest.fn().mockReturnValue('mock-device-id'),
  getDeviceModel: jest.fn().mockReturnValue('mock-model'),
  getOsVersion: jest.fn().mockReturnValue('mock-os'),
}));

// Mock dependencies
jest.mock('react-native', () => ({
  Platform: { OS: 'ios', Version: '18.0' },
  AppState: {
    addEventListener: jest.fn(() => ({
      remove: jest.fn(),
    })),
  },
}));

// Mock global fetch
global.fetch = jest.fn();

// Optional internal access for checking private state in tests
const getQueue = (service: any) => service.queue;

describe('TelemetryService', () => {
  let service: TelemetryService;

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    jest.useFakeTimers();
  });

  afterEach(async () => {
    if (service) await service.stop();
    jest.useRealTimers();
  });

  it('does nothing if config is empty (disabled)', async () => {
    service = new TelemetryService({});
    await service.start();

    service.track('test_event');
    expect(getQueue(service)).toHaveLength(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('tracks basic events and queues them', async () => {
    service = new TelemetryService({ analyticsKey: 'test_key' });
    await service.start();

    // session_start is auto-tracked on start
    expect(getQueue(service)).toHaveLength(1);

    service.track('custom_action', { foo: 'bar' });
    expect(getQueue(service)).toHaveLength(2);

    const events = getQueue(service);
    expect(events[1].type).toBe('custom_action');
    expect(events[1].data.foo).toBe('bar');
    expect(events[1].sessionId).toBeDefined();
  });

  it('flushes automatically when maxBatchSize is reached', async () => {
    service = new TelemetryService({
      analyticsKey: 'test_key',
      maxBatchSize: 3, // Very small for testing
    });

    // Auto-tracks 'session_start' (1 event)
    await service.start();
    const getFlushCalls = () => (global.fetch as jest.Mock).mock.calls.filter(c => !c[0].includes('flags/sync'));
    expect(getFlushCalls()).toHaveLength(0);

    // Track 2nd event (now at 2/3)
    service.track('event_2');
    expect(getFlushCalls()).toHaveLength(0);

    // Track 3rd event (hits maxBatchSize, triggers flush)
    service.track('event_3');

    // Wait for the async flush to fire
    await Promise.resolve();

    expect(getFlushCalls()).toHaveLength(1);
    expect(getQueue(service)).toHaveLength(0);

    const callArgs = getFlushCalls()[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.events).toHaveLength(3);
  });

  it('flushes on interval timer', async () => {
    service = new TelemetryService({
      analyticsKey: 'test_key',
      flushIntervalMs: 1000,
    });

    await service.start();
    const getFlushCalls = () => (global.fetch as jest.Mock).mock.calls.filter(c => !c[0].includes('flags/sync'));
    expect(getQueue(service)).toHaveLength(1);
    expect(getFlushCalls()).toHaveLength(0);

    // Advance by 1 second
    (global.fetch as jest.Mock).mockClear();
    jest.advanceTimersByTime(1000);
    await Promise.resolve(); // flush is async

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(getQueue(service)).toHaveLength(0);
  });

  it('re-queues events if flush (network) fails', async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (!url.includes('flags/sync')) {
        throw new Error('Network error');
      }
      return { ok: true, json: async () => ({}) };
    });

    service = new TelemetryService({
      analyticsKey: 'test_key',
      maxBatchSize: 100, // Make batch size large so auto-flush does NOT fire
    });

    await service.start(); // session_start
    service.track('event_2'); // queue has 2 events, auto-flush skipped

    await service.flush(); // Fire manually so we can wait

    const getFlushCalls = () => (global.fetch as jest.Mock).mock.calls.filter(c => !c[0].includes('flags/sync'));
    expect(getFlushCalls()).toHaveLength(1);
    // Queue should still have the 2 events because it failed
    expect(getQueue(service)).toHaveLength(2);
  });

  it('updates screen context for future events', async () => {
    service = new TelemetryService({ analyticsKey: 'test_key' });
    await service.start(); // session_start

    service.setScreen('Home');
    // setting a screen triggers a 'screen_view' event
    expect(getQueue(service)).toHaveLength(2);

    service.track('buy_button_clicked');

    const events = getQueue(service);
    expect(events[2].type).toBe('buy_button_clicked');
    expect(events[2].screen).toBe('Home');
  });

  it('sends data to proxyUrl if provided', async () => {
    service = new TelemetryService({
      analyticsProxyUrl: 'https://my-custom-proxy.com/api',
      analyticsProxyHeaders: { 'X-Custom': '123' },
      maxBatchSize: 2,
    });

    await service.start();
    service.track('test'); // triggered flush
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://my-custom-proxy.com/api',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Custom': '123',
        }),
      })
    );
  });
});
