/**
 * SupportChatModal — full-screen chat modal for human support conversations.
 * Shows message history (bubbles with timestamps/avatars), typing indicator, and reply input.
 * Supports native swipe-down-to-dismiss on iOS pageSheet.
 */

import { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar,
  Keyboard,
} from 'react-native';
import type { AIMessage } from '../core/types';
import { createAIMessage } from '../core/richContent';
import { CloseIcon, SendArrowIcon, LoadingDots } from '../components/Icons';
import { RichContentRenderer } from '../components/rich-content/RichContentRenderer';

// ─── Props ─────────────────────────────────────────────────────

interface SupportChatModalProps {
  visible: boolean;
  messages: AIMessage[];
  onSend: (message: string) => void;
  onClose: () => void;
  isAgentTyping?: boolean;
  isThinking?: boolean;
  /** Optional: externally controlled scroll trigger. Pass when messages update externally. */
  scrollToEndTrigger?: number;
  /** Ticket status — when 'closed' or 'resolved', input is hidden and a banner is shown. */
  ticketStatus?: string;
}

// ─── Helpers ───────────────────────────────────────────────────

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function shouldShowDateSeparator(prev: AIMessage | undefined, curr: AIMessage): boolean {
  if (!prev) return true;
  const prevDay = new Date(prev.timestamp).toDateString();
  const currDay = new Date(curr.timestamp).toDateString();
  return prevDay !== currDay;
}

function formatDateSeparator(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── Agent Avatar ──────────────────────────────────────────────

function AgentAvatar() {
  return (
    <View style={s.agentAvatar}>
      <View style={s.avatarHead} />
      <View style={s.avatarBody} />
    </View>
  );
}

// ─── Main Component ────────────────────────────────────────────

const CLOSED_STATUSES = ['closed', 'resolved'];

export function SupportChatModal({
  visible,
  messages,
  onSend,
  onClose,
  isAgentTyping = false,
  isThinking = false,
  scrollToEndTrigger = 0,
  ticketStatus,
}: SupportChatModalProps) {
  const isClosed = !!ticketStatus && CLOSED_STATUSES.includes(ticketStatus);
  const [text, setText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const seededIntroMessageRef = useRef<AIMessage>(
    createAIMessage({
      id: 'support-intro-message',
      role: 'assistant',
      content: 'A support agent will help you solve this problem soon.',
      previewText: 'A support agent will help you solve this problem soon.',
      timestamp: Date.now(),
    })
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scrollRef = useRef<any>(null);
  const renderedMessages = messages.length > 0 ? messages : [seededIntroMessageRef.current];

  // Scroll to bottom when new messages arrive or typing indicator changes
  useEffect(() => {
    if (renderedMessages.length > 0 || isAgentTyping) {
      setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 150);
    }
  }, [renderedMessages.length, isAgentTyping]);

  // Scroll when externally triggered (e.g., after message update in parent)
  useEffect(() => {
    if (scrollToEndTrigger && scrollToEndTrigger > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 200);
    }
  }, [scrollToEndTrigger]);

  // Manually track keyboard height — reliable inside iOS pageSheet modals
  // where KeyboardAvoidingView miscalculates the offset from screen origin.
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardWillShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 100);
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleSend = () => {
    if (!text.trim() || isThinking) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" />
      <View style={[s.container, keyboardHeight > 0 && { paddingBottom: keyboardHeight }]}>
        {/* Drag grip indicator */}
        <View style={s.dragHandle}>
          <View style={s.dragGrip} />
        </View>

        {/* ── Header ── */}
        <View style={s.header}>
          <Pressable onPress={onClose} style={s.headerBtn} hitSlop={12}>
            <CloseIcon size={20} color="rgba(255,255,255,0.7)" />
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Support Chat</Text>
            <View style={s.headerStatus}>
              <View style={[s.statusDot, isClosed && s.statusDotClosed]} />
              <Text style={s.headerSubtitle}>
                {isClosed ? 'Conversation closed' : 'Agent online'}
              </Text>
            </View>
          </View>
          <View style={s.headerBtn} />
        </View>

        {/* ── Messages ── */}
        <ScrollView
          ref={scrollRef}
          style={s.messagesList}
          contentContainerStyle={s.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderedMessages.map((msg, i) => {
            const isUser = msg.role === 'user';
            const prev = renderedMessages[i - 1];
            const showDate = shouldShowDateSeparator(prev, msg);

            return (
              <View key={msg.id}>
                {/* Date separator */}
                {showDate && (
                  <View style={s.dateSeparator}>
                    <View style={s.dateLine} />
                    <Text style={s.dateText}>{formatDateSeparator(msg.timestamp)}</Text>
                    <View style={s.dateLine} />
                  </View>
                )}

                {/* Message row */}
                <View style={[s.messageRow, isUser && s.messageRowUser]}>
                  {/* Agent avatar (left side) */}
                  {!isUser && <AgentAvatar />}

                  <View style={s.bubbleColumn}>
                    <View
                      style={[
                        s.bubble,
                        isUser ? s.bubbleUser : s.bubbleAgent,
                      ]}
                    >
                      <RichContentRenderer
                        content={msg.content}
                        surface="support"
                        isUser={isUser}
                        textStyle={[s.bubbleText, !isUser && s.bubbleTextAgent]}
                      />
                    </View>
                    <Text style={[s.timestamp, isUser && s.timestampUser]}>
                      {formatRelativeTime(msg.timestamp)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}

          {/* Typing indicator */}
          {isAgentTyping && (
            <View style={s.messageRow}>
              <AgentAvatar />
              <View style={s.bubbleColumn}>
                <View style={[s.bubble, s.bubbleAgent, s.typingBubble]}>
                  <LoadingDots size={20} color="rgba(255,255,255,0.6)" />
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── Input Row or Closed Banner ── */}
        {isClosed ? (
          <View style={s.closedBanner}>
            <Text style={s.closedBannerText}>
              This conversation has been closed. Start a new request to get help.
            </Text>
          </View>
        ) : (
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              placeholder="Type a message..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={text}
              onChangeText={setText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              editable={!isThinking}
            />
            <Pressable
              style={[s.sendBtn, text.trim() && !isThinking ? s.sendBtnActive : s.sendBtnInactive]}
              onPress={handleSend}
              disabled={!text.trim() || isThinking}
            >
              <SendArrowIcon size={18} color={text.trim() && !isThinking ? '#fff' : 'rgba(255,255,255,0.3)'} />
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },

  // ── Drag Handle ──
  dragHandle: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingBottom: 6,
  },
  dragGrip: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#34C759',
  },
  statusDotClosed: {
    backgroundColor: '#8E8E93',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '500',
  },

  // ── Messages ──
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 16,
  },

  // ── Date Separator ──
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  dateLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dateText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Message Row ──
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4,
    gap: 8,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleColumn: {
    maxWidth: '72%',
  },

  // ── Bubble ──
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: '#7B68EE',
    borderBottomRightRadius: 6,
    elevation: 2,
    shadowColor: '#7B68EE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  bubbleAgent: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
    color: '#fff',
  },
  bubbleTextAgent: {
    color: 'rgba(255,255,255,0.9)',
  },

  // ── Timestamp ──
  timestamp: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 11,
    marginTop: 4,
    marginLeft: 4,
    marginBottom: 6,
  },
  timestampUser: {
    textAlign: 'right',
    marginRight: 4,
    marginLeft: 0,
  },

  // ── Agent Avatar ──
  agentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#7B68EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarHead: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  avatarBody: {
    width: 16,
    height: 6,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    marginTop: 1,
  },

  // ── Typing Indicator ──
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 60,
  },

  // ── Empty State ──
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyBubble: {
    width: 48,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  emptyTail: {
    position: 'absolute',
    bottom: 10,
    left: 16,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderRightWidth: 8,
    borderRightColor: 'transparent',
  },
  emptyTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 14,
  },

  // ── Closed Banner ──
  closedBanner: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  closedBannerText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },

  // ── Input Row ──
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 11,
    color: '#fff',
    fontSize: 16,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnActive: {
    backgroundColor: '#7B68EE',
    elevation: 3,
    shadowColor: '#7B68EE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  sendBtnInactive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
