import { MobileAI, bindTelemetryService } from '../../../services/telemetry/MobileAI';
import { TelemetryService } from '../../../services/telemetry/TelemetryService';

// Mock the logger to prevent console noise during tests
jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('MobileAI static API', () => {
  let mockService: jest.Mocked<TelemetryService>;

  beforeEach(() => {
    // Reset the internal binding before each test
    bindTelemetryService(null);
    jest.clearAllMocks();

    // Create a mock TelemetryService
    mockService = {
      track: jest.fn(),
      setScreen: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      flush: jest.fn(),
    } as unknown as jest.Mocked<TelemetryService>;
  });

  describe('when unconfigured', () => {
    it('track() safely ignores calls (no-op)', () => {
      expect(() => {
        MobileAI.track('my_event');
      }).not.toThrow();
      
      const { logger } = require('../../../utils/logger');
      expect(logger.debug).toHaveBeenCalledWith(
        'MobileAI',
        "track('my_event') ignored — no analyticsKey configured"
      );
    });

    it('identify() safely ignores calls (no-op)', () => {
      expect(() => {
        MobileAI.identify('user_123');
      }).not.toThrow();

      const { logger } = require('../../../utils/logger');
      expect(logger.debug).toHaveBeenCalledWith(
        'MobileAI',
        'identify() ignored — no analyticsKey configured'
      );
    });
  });

  describe('when configured (bound to service)', () => {
    beforeEach(() => {
      bindTelemetryService(mockService);
    });

    it('track() forwards event name and data to service', () => {
      const data = { price: 9.99, currency: 'USD' };
      MobileAI.track('purchase', data);

      expect(mockService.track).toHaveBeenCalledTimes(1);
      expect(mockService.track).toHaveBeenCalledWith('purchase', data);
    });

    it('track() defaults to empty object for data if none provided', () => {
      MobileAI.track('click_button');

      expect(mockService.track).toHaveBeenCalledTimes(1);
      expect(mockService.track).toHaveBeenCalledWith('click_button', {});
    });

    it('identify() formats as track event with user_id', () => {
      const traits = { plan: 'pro', role: 'admin' };
      MobileAI.identify('usr_456', traits);

      expect(mockService.track).toHaveBeenCalledTimes(1);
      expect(mockService.track).toHaveBeenCalledWith('identify', {
        user_id: 'usr_456',
        plan: 'pro',
        role: 'admin',
      });
    });

    it('identify() works without optional traits', () => {
      MobileAI.identify('usr_999');

      expect(mockService.track).toHaveBeenCalledTimes(1);
      expect(mockService.track).toHaveBeenCalledWith('identify', {
        user_id: 'usr_999',
      });
    });
  });
});
