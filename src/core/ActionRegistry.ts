import type { ActionDefinition, ActionParameterDef } from './types';

export interface MCPToolDeclaration {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

/**
 * A central registry for all actions registered via `useAction`.
 * This acts as the single source of truth for:
 * 1. The in-app AI Agent (AgentRuntime)
 * 2. The MCP Server (external agents)
 * 3. iOS App Intents (Siri)
 * 4. Android AppFunctions (Gemini)
 */
export class ActionRegistry {
  private actions = new Map<string, ActionDefinition>();
  private listeners = new Set<() => void>();

  /** Register a new action definition */
  register(action: ActionDefinition): void {
    this.actions.set(action.name, action);
    this.notify();
  }

  /** Unregister an action by name */
  unregister(name: string): void {
    this.actions.delete(name);
    this.notify();
  }

  /** Get a specific action by name */
  get(name: string): ActionDefinition | undefined {
    return this.actions.get(name);
  }

  /** Get all registered actions */
  getAll(): ActionDefinition[] {
    return Array.from(this.actions.values());
  }

  /** Clear all registered actions (useful for testing) */
  clear(): void {
    this.actions.clear();
    this.notify();
  }

  /**
   * Subscribe to changes (e.g. when a new screen mounts and registers actions).
   * Useful for the MCP server to re-announce tools.
   */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Serialize all actions as strictly-typed MCP tool declarations */
  toMCPTools(): MCPToolDeclaration[] {
    return this.getAll().map((a) => ({
      name: a.name,
      description: a.description,
      inputSchema: this.buildInputSchema(a.parameters),
    }));
  }

  private buildInputSchema(params: Record<string, string | ActionParameterDef>) {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [key, val] of Object.entries(params)) {
      if (typeof val === 'string') {
        // Backward compatibility: passing a string means it's a required string param.
        properties[key] = { type: 'string', description: val };
        required.push(key);
      } else {
        // New strict parameter definition
        properties[key] = { type: val.type, description: val.description };
        if (val.enum) {
          properties[key].enum = val.enum;
        }
        if (val.required !== false) {
          required.push(key);
        }
      }
    }

    return { type: 'object', properties, required };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

// Export a singleton instance. 
// This allows background channels (like App Intents bridging) to access actions 
// even if the React tree hasn't accessed the AIAgent context yet.
export const actionRegistry = new ActionRegistry();
