/**
 * ConversationService — backend-persisted AI conversation history.
 *
 * Saves and retrieves AI chat sessions from the MobileAI backend so users
 * can browse and continue previous conversations across app launches.
 *
 * All methods are no-ops when analyticsKey is absent (graceful degradation).
 * All network errors are silently swallowed — history is best-effort and must
 * never break the core agent flow.
 */

import { ENDPOINTS } from '../config/endpoints';
import type { AIMessage, ConversationSummary } from '../core/types';
import { createAIMessage, normalizeRichContent, richContentToPlainText } from '../core/richContent';
import { logger } from '../utils/logger';

// ─── Types ───────────────────────────────────────────────────────

interface MessagePayload {
  role: string;
  content: string;
  previewText: string;
  timestamp: number;
}

interface StartConversationParams {
  analyticsKey: string;
  userId?: string;
  deviceId?: string;
  messages: AIMessage[];
}

interface AppendMessagesParams {
  conversationId: string;
  analyticsKey: string;
  userId?: string;
  deviceId?: string;
  messages: AIMessage[];
}

interface FetchConversationsParams {
  analyticsKey: string;
  userId?: string;
  deviceId?: string;
  limit?: number;
}

interface FetchConversationParams {
  conversationId: string;
  analyticsKey: string;
  userId?: string;
  deviceId?: string;
}

interface LocalConversationRecord extends ConversationSummary {
  messages: MessagePayload[];
}

interface LocalConversationStore {
  conversations: LocalConversationRecord[];
}

const LOCAL_CONVERSATION_PREFIX = 'local_ai_conv_';
const LOCAL_STORE_PREFIX = '@mobileai:ai-conversations:v1:';

let storageLoaded = false;
let storage: any = null;

function loadStorage(): any | null {
  if (storageLoaded) return storage;
  storageLoaded = true;

  try {
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      const msg = args[0];
      if (typeof msg === 'string' && msg.includes('AsyncStorage')) return;
      origError.apply(console, args);
    };
    try {
      const mod = require('@react-native-async-storage/async-storage');
      const candidate = mod?.default ?? mod?.AsyncStorage ?? null;
      if (candidate && typeof candidate.getItem === 'function') {
        storage = candidate;
      }
    } finally {
      console.error = origError;
    }
  } catch {
    storage = null;
  }

  return storage;
}

function identityKey(analyticsKey: string, userId?: string, deviceId?: string): string | null {
  const identity = userId || deviceId;
  if (!analyticsKey || !identity) return null;
  return `${LOCAL_STORE_PREFIX}${analyticsKey}:${identity}`;
}

function createLocalConversationId(): string {
  return `${LOCAL_CONVERSATION_PREFIX}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isLocalConversationId(conversationId: string): boolean {
  return conversationId.startsWith(LOCAL_CONVERSATION_PREFIX);
}

async function readLocalStore(
  analyticsKey: string,
  userId?: string,
  deviceId?: string
): Promise<LocalConversationStore> {
  const AS = loadStorage();
  const key = identityKey(analyticsKey, userId, deviceId);
  if (!AS || !key) return { conversations: [] };

  try {
    const raw = await AS.getItem(key);
    if (!raw) return { conversations: [] };
    const parsed = JSON.parse(raw) as LocalConversationStore;
    return { conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [] };
  } catch {
    return { conversations: [] };
  }
}

async function writeLocalStore(
  analyticsKey: string,
  userId: string | undefined,
  deviceId: string | undefined,
  store: LocalConversationStore
): Promise<void> {
  const AS = loadStorage();
  const key = identityKey(analyticsKey, userId, deviceId);
  if (!AS || !key) return;

  try {
    await AS.setItem(key, JSON.stringify(store));
  } catch {
    // Local history is a best-effort mirror.
  }
}

async function upsertLocalConversation({
  analyticsKey,
  userId,
  deviceId,
  conversationId,
  messages,
}: {
  analyticsKey: string;
  userId?: string;
  deviceId?: string;
  conversationId: string;
  messages: AIMessage[];
}): Promise<void> {
  const payload = toPayload(messages);
  if (!payload.length) return;

  const store = await readLocalStore(analyticsKey, userId, deviceId);
  const now = Date.now();
  const firstUserMessage = payload.find((m) => m.role === 'user');
  const lastMessage = payload[payload.length - 1];
  const existing = store.conversations.find((c) => c.id === conversationId);
  const mergedMessages = existing ? [...existing.messages, ...payload] : payload;

  const nextRecord: LocalConversationRecord = {
    id: conversationId,
    title: existing?.title || (firstUserMessage?.previewText || firstUserMessage?.content || 'New conversation').slice(0, 80),
    preview: (lastMessage?.previewText || lastMessage?.content || '').slice(0, 100),
    previewRole: lastMessage?.role || 'assistant',
    messageCount: mergedMessages.length,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    messages: mergedMessages,
  };

  const nextConversations = [
    nextRecord,
    ...store.conversations.filter((c) => c.id !== conversationId),
  ].slice(0, 50);

  await writeLocalStore(analyticsKey, userId, deviceId, { conversations: nextConversations });
}

// ─── Serialization ───────────────────────────────────────────────

function toPayload(msgs: AIMessage[]): MessagePayload[] {
  return msgs
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .filter((m) => m.previewText.trim().length > 0)
    .map((m) => ({
      role: m.role,
      content: richContentToPlainText(m.content, m.previewText),
      previewText: m.previewText,
      timestamp: m.timestamp,
    }));
}

// ─── Service ─────────────────────────────────────────────────────

/**
 * Start a new conversation on the backend.
 * Call this when the first AI response arrives in a new session.
 * Returns the backend conversationId, or null on failure.
 */
export async function startConversation({
  analyticsKey,
  userId,
  deviceId,
  messages,
}: StartConversationParams): Promise<string | null> {
  if (!analyticsKey) return null;

  const payload = toPayload(messages);
  if (!payload.length) return null;

  try {
    const res = await fetch(ENDPOINTS.conversations, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analyticsKey,
        userId: userId || undefined,
        deviceId: deviceId || undefined,
        messages: payload,
      }),
    });

    if (!res.ok) {
      logger.warn('ConversationService', `startConversation failed: ${res.status}`);
      const conversationId = createLocalConversationId();
      await upsertLocalConversation({
        analyticsKey,
        userId,
        deviceId,
        conversationId,
        messages,
      });
      return conversationId;
    }

    const data = await res.json();
    logger.info('ConversationService', `Started conversation: ${data.conversationId}`);
    const conversationId = data.conversationId as string;
    await upsertLocalConversation({
      analyticsKey,
      userId,
      deviceId,
      conversationId,
      messages,
    });
    return conversationId;
  } catch (err) {
    logger.warn('ConversationService', `startConversation error: ${err}`);
    const conversationId = createLocalConversationId();
    await upsertLocalConversation({
      analyticsKey,
      userId,
      deviceId,
      conversationId,
      messages,
    });
    return conversationId;
  }
}

/**
 * Append new messages to an existing conversation.
 * Fire-and-forget — call after each exchange (debounce in caller).
 */
export async function appendMessages({
  conversationId,
  analyticsKey,
  userId,
  deviceId,
  messages,
}: AppendMessagesParams): Promise<boolean> {
  if (!analyticsKey || !conversationId) return false;

  const payload = toPayload(messages);
  if (!payload.length) return false;

  await upsertLocalConversation({
    analyticsKey,
    userId,
    deviceId,
    conversationId,
    messages,
  });

  if (isLocalConversationId(conversationId)) return true;

  try {
    const res = await fetch(ENDPOINTS.conversations, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analyticsKey, conversationId, messages: payload }),
    });

    if (!res.ok) {
      logger.warn('ConversationService', `appendMessages failed: ${res.status}`);
      return true;
    }
    return true;
  } catch (err) {
    logger.warn('ConversationService', `appendMessages error: ${err}`);
    return true;
  }
}

/**
 * Fetch the user's conversation list (most-recent-first).
 * Returns empty array on failure — never throws.
 */
export async function fetchConversations({
  analyticsKey,
  userId,
  deviceId,
  limit = 20,
}: FetchConversationsParams): Promise<ConversationSummary[]> {
  if (!analyticsKey) return [];
  if (!userId && !deviceId) return [];

  const localStore = await readLocalStore(analyticsKey, userId, deviceId);
  const localSummaries: ConversationSummary[] = localStore.conversations.map(({ messages: _messages, ...summary }) => summary);

  try {
    const params = new URLSearchParams({ analyticsKey, limit: String(limit) });
    if (userId) params.set('userId', userId);
    if (deviceId) params.set('deviceId', deviceId);

    const res = await fetch(`${ENDPOINTS.conversations}?${params.toString()}`);
    if (!res.ok) {
      logger.warn('ConversationService', `fetchConversations failed: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const remoteSummaries = (data.conversations as ConversationSummary[]) ?? [];
    const remoteIds = new Set(remoteSummaries.map((c) => c.id));

    return [
      ...remoteSummaries,
      ...localSummaries.filter((c) => !remoteIds.has(c.id)),
    ]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  } catch (err) {
    logger.warn('ConversationService', `fetchConversations error: ${err}`);
    return localSummaries.slice(0, limit);
  }
}

/**
 * Fetch the full message history of a single conversation.
 * Returns null on failure.
 */
export async function fetchConversation({
  conversationId,
  analyticsKey,
  userId,
  deviceId,
}: FetchConversationParams): Promise<AIMessage[] | null> {
  if (!analyticsKey || !conversationId) return null;

  if (isLocalConversationId(conversationId)) {
    const store = await readLocalStore(analyticsKey, userId, deviceId);
    const localConversation = store.conversations.find((c) => c.id === conversationId);
    if (!localConversation) return null;

    return localConversation.messages.map((m, index) =>
      createAIMessage({
        id: `${conversationId}-${index}`,
        role: m.role as 'user' | 'assistant',
        content: normalizeRichContent(m.content),
        previewText: m.previewText || m.content,
        timestamp: m.timestamp,
      })
    );
  }

  try {
    const params = new URLSearchParams({ analyticsKey });
    const res = await fetch(`${ENDPOINTS.conversations}/${conversationId}?${params.toString()}`);

    if (!res.ok) {
      logger.warn('ConversationService', `fetchConversation failed: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const msgs: AIMessage[] = (data.messages ?? []).map(
      (m: { id: string; role: string; content: string | unknown[]; previewText?: string; timestamp: number }) =>
        createAIMessage({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: normalizeRichContent(m.content as any),
          previewText: m.previewText || richContentToPlainText(m.content as any),
          timestamp: m.timestamp,
        }),
    );
    return msgs;
  } catch (err) {
    logger.warn('ConversationService', `fetchConversation error: ${err}`);
    const store = await readLocalStore(analyticsKey, userId, deviceId);
    const localConversation = store.conversations.find((c) => c.id === conversationId);
    if (localConversation) {
      return localConversation.messages.map((m, index) =>
        createAIMessage({
          id: `${conversationId}-${index}`,
          role: m.role as 'user' | 'assistant',
          content: normalizeRichContent(m.content),
          previewText: m.previewText || m.content,
          timestamp: m.timestamp,
        })
      );
    }
    return null;
  }
}
