import { TelemetryService } from '../../../services/telemetry/TelemetryService';
import { Platform, AppState } from 'react-native';

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
    expect(global.fetch).not.toHaveBeenCalled();

    // Track 2nd event (now at 2/3)
    service.track('event_2');
    expect(global.fetch).not.toHaveBeenCalled();

    // Track 3rd event (hits maxBatchSize, triggers flush)
    service.track('event_3');
    
    // Wait for the async flush to fire
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(getQueue(service)).toHaveLength(0);

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.events).toHaveLength(3);
  });

  it('flushes on interval timer', async () => {
    service = new TelemetryService({
      analyticsKey: 'test_key',
      flushIntervalMs: 1000,
    });
    
    await service.start();
    expect(getQueue(service)).toHaveLength(1);
    expect(global.fetch).not.toHaveBeenCalled();

    // Advance by 1 second
    jest.advanceTimersByTime(1000);
    await Promise.resolve(); // flush is async

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(getQueue(service)).toHaveLength(0);
  });

  it('re-queues events if flush (network) fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    
    service = new TelemetryService({
      analyticsKey: 'test_key',
      maxBatchSize: 2,
    });
    
    await service.start(); // session_start
    service.track('event_2'); // hits batch size and flushes
    
    await Promise.resolve(); // handle promise rejections
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledTimes(1);
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
