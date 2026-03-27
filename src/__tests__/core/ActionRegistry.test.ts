import { ActionRegistry } from '../../core/ActionRegistry';

describe('ActionRegistry', () => {
  let registry: ActionRegistry;

  beforeEach(() => {
    registry = new ActionRegistry();
  });

  it('registers and unregisters actions', () => {
    const handler = jest.fn();
    registry.register({
      name: 'test_action',
      description: 'A test action',
      parameters: { id: 'Test ID' },
      handler,
    });

    expect(registry.get('test_action')).toBeDefined();
    expect(registry.getAll().length).toBe(1);

    registry.unregister('test_action');
    expect(registry.get('test_action')).toBeUndefined();
    expect(registry.getAll().length).toBe(0);
  });

  it('notifies listeners on change', () => {
    const listener = jest.fn();
    const unsubscribe = registry.onChange(listener);

    registry.register({
      name: 'action1',
      description: 'desc',
      parameters: {},
      handler: jest.fn(),
    });

    expect(listener).toHaveBeenCalledTimes(1);

    registry.unregister('action1');
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    registry.register({
      name: 'action2',
      description: 'desc',
      parameters: {},
      handler: jest.fn(),
    });

    expect(listener).toHaveBeenCalledTimes(2); // Should not increase
  });

  it('builds valid MCP tool declarations from string parameters (backward compat)', () => {
    registry.register({
      name: 'legacy_action',
      description: 'Legacy style',
      parameters: {
        userId: 'The ID of the user',
      },
      handler: jest.fn(),
    });

    const mcpTools = registry.toMCPTools();
    expect(mcpTools.length).toBe(1);
    expect(mcpTools[0]).toEqual({
      name: 'legacy_action',
      description: 'Legacy style',
      inputSchema: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'The ID of the user' },
        },
        required: ['userId'],
      },
    });
  });

  it('builds strict MCP tool declarations using ActionParameterDef', () => {
    registry.register({
      name: 'strict_action',
      description: 'Strict style',
      parameters: {
        quantity: { type: 'number', description: 'Amount to add', required: true },
        size: { type: 'string', description: 'Item size', enum: ['S', 'M', 'L'], required: false },
        giftWrap: { type: 'boolean', description: 'Wrap it?' }, // defaults to true if omitted
      },
      handler: jest.fn(),
    });

    const mcpTools = registry.toMCPTools();
    expect(mcpTools[0]).toEqual({
      name: 'strict_action',
      description: 'Strict style',
      inputSchema: {
        type: 'object',
        properties: {
          quantity: { type: 'number', description: 'Amount to add' },
          size: { type: 'string', description: 'Item size', enum: ['S', 'M', 'L'] },
          giftWrap: { type: 'boolean', description: 'Wrap it?' },
        },
        required: ['quantity', 'giftWrap'],
      },
    });
  });
});
