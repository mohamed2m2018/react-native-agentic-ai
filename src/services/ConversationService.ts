/**
 * ConversationService — chat history through the app's ConversationStore.
 *
 * Thin, never-throwing wrapper: every method is a no-op without a store, and
 * store errors are logged and swallowed, because history is best-effort and
 * must never break the agent flow.
 */

import type {
  AIMessage,
  ConversationMessage,
  ConversationStore,
  ConversationSummary,
} from '../core/types';
import { createAIMessage, richContentToPlainText } from '../core/richContent';
import { logger } from '../utils/logger';

const LOG_TAG = 'ConversationService';

function toStoreMessages(msgs: AIMessage[]): ConversationMessage[] {
  return msgs
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .filter((m) => m.previewText.trim().length > 0)
    .map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: richContentToPlainText(m.content, m.previewText),
      previewText: m.previewText,
      timestamp: m.timestamp,
      kind: m.promptKind === 'approval' ? 'approval' : 'chat',
    }));
}

function fromStoreMessage(m: ConversationMessage, index: number): AIMessage {
  return createAIMessage({
    id: m.id ?? `restored-${m.timestamp}-${index}`,
    role: m.role,
    content: m.content,
    previewText: m.previewText || m.content,
    timestamp: m.timestamp,
    ...(m.kind === 'approval' ? { promptKind: 'approval' as const } : {}),
  });
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface SaveParams {
  store?: ConversationStore;
  conversationId?: string;
  userId?: string;
  deviceId: string;
  messages: AIMessage[];
}

/** Saves new messages. Returns the conversation id, or null on failure. */
export async function saveMessages({
  store,
  conversationId,
  userId,
  deviceId,
  messages,
}: SaveParams): Promise<string | null> {
  if (!store) return null;
  const payload = toStoreMessages(messages);
  if (payload.length === 0) return conversationId ?? null;
  try {
    const id = await store.save({
      conversationId,
      messages: payload,
      userId,
      deviceId,
    });
    return typeof id === 'string' && id ? id : null;
  } catch (err) {
    logger.warn(LOG_TAG, `save failed: ${describe(err)}`);
    return null;
  }
}

/** Lists recent conversations. Returns [] on failure. */
export async function listConversations({
  store,
  userId,
  deviceId,
  limit = 20,
}: {
  store?: ConversationStore;
  userId?: string;
  deviceId: string;
  limit?: number;
}): Promise<ConversationSummary[]> {
  if (!store) return [];
  try {
    const list = await store.list({ userId, deviceId, limit });
    return Array.isArray(list) ? list.slice(0, limit) : [];
  } catch (err) {
    logger.warn(LOG_TAG, `list failed: ${describe(err)}`);
    return [];
  }
}

/** Loads one conversation's messages. Returns null on failure. */
export async function loadConversation(
  store: ConversationStore | undefined,
  conversationId: string
): Promise<AIMessage[] | null> {
  if (!store || !conversationId) return null;
  try {
    const msgs = await store.load(conversationId);
    return Array.isArray(msgs) ? msgs.map(fromStoreMessage) : null;
  } catch (err) {
    logger.warn(LOG_TAG, `load failed: ${describe(err)}`);
    return null;
  }
}

/** Tells the store a conversation ended. Fire-and-forget. */
export function endConversation(
  store: ConversationStore | undefined,
  conversationId: string
): void {
  if (!store?.end || !conversationId) return;
  store
    .end(conversationId)
    .catch((err) => logger.warn(LOG_TAG, `end failed: ${describe(err)}`));
}
