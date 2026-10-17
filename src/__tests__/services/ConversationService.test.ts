import * as ConversationService from '../../services/ConversationService';
import { createAIMessage } from '../../core/richContent';
import type { ConversationStore, ConversationMessage } from '../../core/types';

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const msg = (
  id: string,
  role: 'user' | 'assistant',
  text: string,
  promptKind?: 'approval'
) =>
  createAIMessage({
    id,
    role,
    content: text,
    previewText: text,
    timestamp: 1000,
    promptKind,
  });

function memoryStore(): ConversationStore & { saved: ConversationMessage[][] } {
  const data = new Map<string, ConversationMessage[]>();
  const saved: ConversationMessage[][] = [];
  return {
    saved,
    async save({ conversationId, messages }) {
      saved.push(messages);
      const id = conversationId ?? `c${data.size + 1}`;
      data.set(id, [...(data.get(id) ?? []), ...messages]);
      return id;
    },
    async list({ limit }) {
      return [...data.keys()].slice(0, limit).map((id) => ({
        id,
        title: id,
        preview: '',
        previewRole: 'assistant',
        messageCount: data.get(id)!.length,
        createdAt: 0,
        updatedAt: 0,
      }));
    },
    async load(id) {
      return data.get(id) ?? [];
    },
  };
}

describe('ConversationService (store adapter)', () => {
  it('is a no-op without a store', async () => {
    expect(
      await ConversationService.saveMessages({
        deviceId: 'd',
        messages: [msg('1', 'user', 'hi')],
      })
    ).toBeNull();
    expect(
      await ConversationService.listConversations({ deviceId: 'd' })
    ).toEqual([]);
    expect(
      await ConversationService.loadConversation(undefined, 'c1')
    ).toBeNull();
  });

  it('creates a conversation, then appends to it', async () => {
    const store = memoryStore();
    const id = await ConversationService.saveMessages({
      store,
      deviceId: 'd',
      messages: [msg('1', 'user', 'hi')],
    });
    expect(id).toBe('c1');
    const again = await ConversationService.saveMessages({
      store,
      conversationId: id!,
      deviceId: 'd',
      messages: [msg('2', 'assistant', 'hello')],
    });
    expect(again).toBe('c1');
    const loaded = await ConversationService.loadConversation(store, 'c1');
    expect(loaded?.map((m) => [m.id, m.role, m.previewText])).toEqual([
      ['1', 'user', 'hi'],
      ['2', 'assistant', 'hello'],
    ]);
  });

  it('marks approval taps and keeps them through a round trip', async () => {
    const store = memoryStore();
    await ConversationService.saveMessages({
      store,
      deviceId: 'd',
      messages: [msg('1', 'user', 'Allow', 'approval')],
    });
    expect(store.saved[0]![0]!.kind).toBe('approval');
    const loaded = await ConversationService.loadConversation(store, 'c1');
    expect(loaded?.[0]?.promptKind).toBe('approval');
  });

  it('swallows store errors', async () => {
    const broken: ConversationStore = {
      save: () => Promise.reject(new Error('disk full')),
      list: () => Promise.reject(new Error('offline')),
      load: () => Promise.reject(new Error('offline')),
      end: () => Promise.reject(new Error('offline')),
    };
    expect(
      await ConversationService.saveMessages({
        store: broken,
        deviceId: 'd',
        messages: [msg('1', 'user', 'hi')],
      })
    ).toBeNull();
    expect(
      await ConversationService.listConversations({
        store: broken,
        deviceId: 'd',
      })
    ).toEqual([]);
    expect(await ConversationService.loadConversation(broken, 'c1')).toBeNull();
    expect(() =>
      ConversationService.endConversation(broken, 'c1')
    ).not.toThrow();
  });
});
