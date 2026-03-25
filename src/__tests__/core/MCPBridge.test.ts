/**
 * MCPBridge tests.
 *
 * Covers: request forwarding, concurrent rejection, response sending, auto-reconnect.
 */

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((e: any) => void) | null = null;

  send = jest.fn();
  close = jest.fn();
}

(global as any).WebSocket = MockWebSocket;

// Mock logger to suppress output
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { MCPBridge } from '../../core/MCPBridge';

// ─── Mock Runtime Factory ──────────────────────────────────────

function createMockRuntime(isRunning = false) {
  return {
    getIsRunning: jest.fn().mockReturnValue(isRunning),
    execute: jest.fn().mockResolvedValue({
      success: true,
      message: 'Task completed',
      steps: [],
    }),
  } as any;
}

describe('MCPBridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('forwards request to runtime.execute()', async () => {
    const runtime = createMockRuntime(false);
    const bridge = new MCPBridge('ws://localhost:3101', runtime);

    // Simulate connection
    const ws = (bridge as any).ws as MockWebSocket;
    ws.onopen?.();

    // Simulate incoming request
    const requestData = JSON.stringify({
      type: 'request',
      command: 'Navigate to settings',
      requestId: 'req-123',
    });
    await ws.onmessage?.({ data: requestData });

    expect(runtime.execute).toHaveBeenCalledWith('Navigate to settings');

    bridge.destroy();
  });

  it('rejects request when agent is already running', async () => {
    const runtime = createMockRuntime(true);
    const bridge = new MCPBridge('ws://localhost:3101', runtime);

    const ws = (bridge as any).ws as MockWebSocket;
    ws.onopen?.();

    const requestData = JSON.stringify({
      type: 'request',
      command: 'Do something',
      requestId: 'req-456',
    });
    await ws.onmessage?.({ data: requestData });

    expect(runtime.execute).not.toHaveBeenCalled();
    expect(ws.send).toHaveBeenCalled();
    const sentData = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sentData.payload.success).toBe(false);
    expect(sentData.payload.message).toContain('already running');

    bridge.destroy();
  });

  it('sends response back via WebSocket', async () => {
    const runtime = createMockRuntime(false);
    const bridge = new MCPBridge('ws://localhost:3101', runtime);

    const ws = (bridge as any).ws as MockWebSocket;
    ws.onopen?.();

    const requestData = JSON.stringify({
      type: 'request',
      command: 'test task',
      requestId: 'req-789',
    });
    await ws.onmessage?.({ data: requestData });

    expect(ws.send).toHaveBeenCalled();
    const sentData = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sentData.type).toBe('response');
    expect(sentData.requestId).toBe('req-789');
    expect(sentData.payload.success).toBe(true);

    bridge.destroy();
  });

  it('schedules reconnect on close', () => {
    const runtime = createMockRuntime(false);
    const bridge = new MCPBridge('ws://localhost:3101', runtime);

    const ws = (bridge as any).ws as MockWebSocket;
    ws.onclose?.();

    // Should have scheduled a reconnect timer
    expect((bridge as any).reconnectTimer).not.toBeNull();

    bridge.destroy();
  });
});
