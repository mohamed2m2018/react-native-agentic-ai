/**
 * useAction — Optional hook to register non-UI actions for the AI agent.
 *
 * Use this for business logic that doesn't correspond to a visible UI element,
 * e.g., API calls, cart operations, calculations.
 *
 * The Fiber tree walker handles visible UI elements automatically.
 * useAction is for invisible operations the AI should be able to trigger.
 */

import { useEffect, useContext, createContext } from 'react';
import type { AgentRuntime } from '../core/AgentRuntime';

// Re-export context creation — AIAgent.tsx will provide the value
export const AgentContext = createContext<AgentRuntime | null>(null);

export function useAction(
  name: string,
  description: string,
  parameters: Record<string, string>,
  handler: (args: Record<string, any>) => any,
): void {
  const agentRuntime = useContext(AgentContext);

  useEffect(() => {
    if (!agentRuntime) return;

    agentRuntime.registerAction({
      name,
      description,
      parameters,
      handler,
    });

    return () => {
      agentRuntime.unregisterAction(name);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, description]);
}
