import React, { createContext, useContext, useMemo } from 'react';

export interface BlockActionPayload {
  actionId: string;
  values?: Record<string, unknown>;
  sourceBlockId?: string;
}

export type BlockActionHandler = (payload: BlockActionPayload) => void | Promise<void>;

interface ActionBridgeValue {
  invoke: (payload: BlockActionPayload) => Promise<void>;
}

const noop = async () => {};

export const ActionBridgeContext = createContext<ActionBridgeValue>({
  invoke: noop,
});

export function ActionBridgeProvider({
  children,
  handlers,
}: {
  children: React.ReactNode;
  handlers?: Record<string, BlockActionHandler>;
}) {
  const value = useMemo<ActionBridgeValue>(
    () => ({
      invoke: async (payload) => {
        const handler = handlers?.[payload.actionId];
        if (handler) {
          await handler(payload);
        }
      },
    }),
    [handlers]
  );

  return (
    <ActionBridgeContext.Provider value={value}>
      {children}
    </ActionBridgeContext.Provider>
  );
}

export function useActionBridge(): ActionBridgeValue {
  return useContext(ActionBridgeContext);
}
