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

function createMockRuntime(isRunning = false, serverMode: 'auto' | 'enabled' | 'disabled' = 'auto') {
  return {
    getConfig: jest.fn().mockReturnValue({ mcpServerMode: serverMode }),
    getIsRunning: jest.fn().mockReturnValue(isRunning),
    execute: jest.fn().mockResolvedValue({
      success: true,
      message: 'Task completed',
      steps: [],
    }),
    getTools: jest.fn().mockReturnValue([
      { name: 'test_tool', description: 'A test tool', parameters: { id: { type: 'string', description: 'desc', required: true } } }
    ]),
    executeTool: jest.fn().mockResolvedValue('Tool ran successfully'),
    getScreenContext: jest.fn().mockReturnValue('<screen>Test</screen>'),
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

  describe('Server Mode (tools/list, tools/call, screen/state)', () => {
    it('rejects server messages if server mode is disabled', async () => {
      const runtime = createMockRuntime(false, 'disabled');
      const bridge = new MCPBridge('ws://localhost:3101', runtime);
      const ws = (bridge as any).ws as MockWebSocket;
      ws.onopen?.();

      await ws.onmessage?.({ data: JSON.stringify({ type: 'tools/list', requestId: '1' }) });
      await ws.onmessage?.({ data: JSON.stringify({ type: 'tools/call', name: 'tool', requestId: '2' }) });
      await ws.onmessage?.({ data: JSON.stringify({ type: 'screen/state', requestId: '3' }) });

      expect(ws.send).toHaveBeenCalledTimes(3);
      const r1 = JSON.parse(ws.send.mock.calls[0][0]);
      expect(r1.payload.error).toContain('disabled');

      bridge.destroy();
    });

    it('handles tools/list correctly when enabled', async () => {
      const runtime = createMockRuntime(false, 'enabled');
      const bridge = new MCPBridge('ws://localhost:3101', runtime);
      const ws = (bridge as any).ws as MockWebSocket;
      ws.onopen?.();

      await ws.onmessage?.({ data: JSON.stringify({ type: 'tools/list', requestId: '1' }) });
      expect(ws.send).toHaveBeenCalledTimes(1);
      const res = JSON.parse(ws.send.mock.calls[0][0]);
      expect(res.payload.tools[0].name).toBe('test_tool');

      bridge.destroy();
    });

    it('handles tools/call correctly when enabled', async () => {
      const runtime = createMockRuntime(false, 'enabled');
      const bridge = new MCPBridge('ws://localhost:3101', runtime);
      const ws = (bridge as any).ws as MockWebSocket;
      ws.onopen?.();

      await ws.onmessage?.({ data: JSON.stringify({ type: 'tools/call', name: 'test_tool', arguments: { id: 'x' }, requestId: '2' }) });
      expect(runtime.executeTool).toHaveBeenCalledWith('test_tool', { id: 'x' });
      expect(ws.send).toHaveBeenCalledTimes(1);
      const res = JSON.parse(ws.send.mock.calls[0][0]);
      expect(res.payload.result).toBe('Tool ran successfully');

      bridge.destroy();
    });

    it('handles screen/state correctly when enabled', async () => {
      const runtime = createMockRuntime(false, 'enabled');
      const bridge = new MCPBridge('ws://localhost:3101', runtime);
      const ws = (bridge as any).ws as MockWebSocket;
      ws.onopen?.();

      await ws.onmessage?.({ data: JSON.stringify({ type: 'screen/state', requestId: '3' }) });
      expect(runtime.getScreenContext).toHaveBeenCalled();
      expect(ws.send).toHaveBeenCalledTimes(1);
      const res = JSON.parse(ws.send.mock.calls[0][0]);
      expect(res.payload.screen).toContain('Test');

      bridge.destroy();
    });
  });
});
