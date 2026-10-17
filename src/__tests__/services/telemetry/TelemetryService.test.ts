import { TelemetryService } from '../../../services/telemetry/TelemetryService';
import { SDK_VERSION } from '../../../config/version';
import type { TelemetryEvent } from '../../../services/telemetry/types';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios', Version: '18.0' },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('TelemetryService', () => {
  it('stays silent without onEvent and makes no network calls', () => {
    const fetchSpy = jest.fn();
    (global as any).fetch = fetchSpy;
    const service = new TelemetryService({});
    service.start();
    service.track('test_event');
    service.stop();
    expect(service.isEnabled()).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('delivers session_start and custom events to onEvent', () => {
    const events: TelemetryEvent[] = [];
    const service = new TelemetryService({ onEvent: (e) => events.push(e) });
    service.start();
    service.track('custom_action', { foo: 'bar' });

    expect(events.map((e) => e.type)).toEqual([
      'session_start',
      'custom_action',
    ]);
    expect(events[0]!.data).toMatchObject({
      device: 'ios',
      os: '18.0',
      sdk_version: SDK_VERSION,
    });
    expect(events[1]!.data.foo).toBe('bar');
    expect(events[1]!.sessionId).toBe(events[0]!.sessionId);
  });

  it('scrubs PII from string values', () => {
    const events: TelemetryEvent[] = [];
    const service = new TelemetryService({ onEvent: (e) => events.push(e) });
    service.track('note', { text: 'mail me at jane@example.com', count: 3 });
    expect(events[0]!.data.text).not.toContain('jane@example.com');
    expect(events[0]!.data.count).toBe(3);
  });

  it('attaches the current screen and emits screen_view on change', () => {
    const events: TelemetryEvent[] = [];
    const service = new TelemetryService({ onEvent: (e) => events.push(e) });
    service.setScreen('CartScreen');
    service.track('tap');
    service.setScreen('CartScreen');

    const views = events.filter((e) => e.type === 'screen_view');
    expect(views).toHaveLength(1);
    expect(events[events.length - 1]!.screen).toBe(service.screen);
    expect(service.getScreenFlow()).toEqual([service.screen]);
  });

  it('keeps working when onEvent throws', () => {
    const service = new TelemetryService({
      onEvent: () => {
        throw new Error('analytics down');
      },
    });
    expect(() => service.track('tap')).not.toThrow();
  });

  it('reports the number of events in session_end', () => {
    const events: TelemetryEvent[] = [];
    const service = new TelemetryService({ onEvent: (e) => events.push(e) });
    service.start();
    service.track('a');
    service.stop();
    const end = events.find((e) => e.type === 'session_end');
    expect(end?.data.events_count).toBe(2);
  });
});

describe('SDK_VERSION', () => {
  it('matches package.json', () => {
    expect(SDK_VERSION).toBe(require('../../../../package.json').version);
  });
});
