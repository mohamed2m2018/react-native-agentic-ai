/**
 * AgentChatBar — Floating, draggable, compressible chat widget.
 * Supports two modes: Text and Voice.
 * Does not block underlying UI natively.
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  ScrollView,
  Keyboard,
  Platform,
  useWindowDimensions,
} from 'react-native';
import type { ExecutionResult, AgentMode, ChatBarTheme, AIMessage } from '../core/types';
import {
  MicIcon,
  SpeakerIcon,
  SendArrowIcon,
  StopIcon,
  LoadingDots,
  AIBadge,
  CloseIcon,
} from './Icons';
import type { SupportTicket } from '../support/types';
import { logger } from '../utils/logger';

// ─── Props ─────────────────────────────────────────────────────

interface AgentChatBarProps {
  onSend: (message: string) => void;
  isThinking: boolean;
  lastResult: ExecutionResult | null;
  language: 'en' | 'ar';
  onDismiss?: () => void;
  /** Available modes (default: ['text']) */
  availableModes?: AgentMode[];
  /** Current active mode */
  mode?: AgentMode;
  onModeChange?: (mode: AgentMode) => void;
  /** Voice controls */
  onMicToggle?: (active: boolean) => void;
  onSpeakerToggle?: (muted: boolean) => void;
  isMicActive?: boolean;
  isSpeakerMuted?: boolean;
  /** AI is currently speaking */
  isAISpeaking?: boolean;
  /** Voice WebSocket is connected */
  isVoiceConnected?: boolean;
  /** Live human agent is typing */
  /** Live human agent is typing */
  isAgentTyping?: boolean; // used by SupportChatModal via AIAgent
  /** Full session cleanup (stop mic, audio, WebSocket, live mode) */
  onStopSession?: () => void;
  /** Color theme overrides */
  theme?: ChatBarTheme;
  /** Active support tickets (for human mode) */
  tickets?: SupportTicket[];
  /** Currently selected ticket ID */
  selectedTicketId?: string | null;
  /** Callback when user selects a ticket */
  onTicketSelect?: (ticketId: string) => void;
  /** Callback when user goes back to ticket list */
  onBackToTickets?: () => void;
  /** Incremented to trigger auto-expand */
  autoExpandTrigger?: number;
  /** Chat messages for selected ticket */
  chatMessages?: AIMessage[];
  /** The user's original typed query — shown in the result bubble instead of agent reasoning */
  lastUserMessage?: string | null;
  /** Unread message counts per ticket (ticketId -> count) */
  unreadCounts?: Record<string, number>;
  /** Total unread messages across all tickets */
  totalUnread?: number;
}

// ─── Mode Selector ─────────────────────────────────────────────

function ModeSelector({
  modes,
  activeMode,
  onSelect,
  isArabic = false,
  totalUnread = 0,
}: {
  modes: AgentMode[];
  activeMode: AgentMode;
  onSelect: (mode: AgentMode) => void;
  isArabic?: boolean;
  totalUnread?: number;
}) {
  if (modes.length <= 1) return null;

  const labels: Record<AgentMode, { label: string }> = {
    text:       { label: isArabic ? 'نص' : 'Text' },
    voice:      { label: isArabic ? 'صوت' : 'Voice' },
    human:      { label: isArabic ? 'دعم' : 'Human' },
  };

  const dotColor: Record<AgentMode, string> = {
    text:       '#7B68EE',
    voice:      '#34C759',
    human:      '#FF9500',
  };

  return (
    <View style={modeStyles.container}>
      {modes.map((mode) => (
        <Pressable
          key={mode}
          style={[
            modeStyles.tab,
            activeMode === mode && modeStyles.tabActive,
          ]}
          onPress={() => onSelect(mode)}
          accessibilityLabel={`Switch to ${labels[mode].label} mode`}
        >
          {/* Active indicator dot */}
          {activeMode === mode && (
            <View style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: dotColor[mode],
            }} />
          )}
          <Text
            style={[
              modeStyles.tabLabel,
              activeMode === mode && modeStyles.tabLabelActive,
            ]}
          >
            {labels[mode].label}
          </Text>
          {/* Unread indicator — inline after label */}
          {mode === 'human' && totalUnread > 0 && (
            <View style={styles.humanTabBadge}>
              <Text style={styles.humanTabBadgeText}>
                {totalUnread > 99 ? '99+' : totalUnread}
              </Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

// ─── Audio Control Button ──────────────────────────────────────

function AudioControlButton({
  children,
  isActive,
  onPress,
  label,
  size = 36,
}: {
  children: React.ReactNode;
  isActive: boolean;
  onPress: () => void;
  label: string;
  size?: number;
}) {
  return (
    <Pressable
      style={[
        audioStyles.controlBtn,
        { width: size, height: size, borderRadius: size / 2 },
        isActive && audioStyles.controlBtnActive,
      ]}
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={8}
    >
      {children}
    </Pressable>
  );
}

// ─── Dictation Button (optional expo-speech-recognition) ──────

/**
 * Try to load expo-speech-recognition as an optional peer dependency.
 * If not installed, returns null and the mic button won't render.
 * Same pattern as react-native-view-shot for screenshots.
 */
let SpeechModule: any = null;
try {
  // Static require — Metro needs a literal string for bundling.
  SpeechModule = require('expo-speech-recognition');
} catch {
  // Not installed — dictation button won't appear
}

function DictationButton({
  language,
  onTranscript,
  disabled,
}: {
  language: string;
  onTranscript: (text: string) => void;
  disabled: boolean;
}) {
  const [isListening, setIsListening] = useState(false);

  // Don't render if expo-speech-recognition isn't installed
  if (!SpeechModule) return null;

  const { ExpoSpeechRecognitionModule } = SpeechModule;
  if (!ExpoSpeechRecognitionModule) return null;

  const toggle = async () => {
    if (isListening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }

    try {
      const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perms.granted) return;

      // Register one-shot listeners for this recording session
      const resultListener = ExpoSpeechRecognitionModule.addListener(
        'result',
        (event: any) => {
          const transcript = event.results?.[0]?.transcript;
          if (transcript && event.isFinal) {
            onTranscript(transcript);
          }
        },
      );

      const endListener = ExpoSpeechRecognitionModule.addListener(
        'end',
        () => {
          setIsListening(false);
          resultListener.remove();
          endListener.remove();
        },
      );

      ExpoSpeechRecognitionModule.start({
        lang: language === 'ar' ? 'ar-SA' : 'en-US',
        interimResults: false,
        continuous: false,
        addsPunctuation: true,
      });

      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  };

  return (
    <Pressable
      style={[
        styles.dictationButton,
        isListening && styles.dictationButtonActive,
        disabled && styles.sendButtonDisabled,
      ]}
      onPress={toggle}
      disabled={disabled}
      accessibilityLabel={isListening ? 'Stop dictation' : 'Start dictation'}
      hitSlop={8}
    >
      {isListening ? <StopIcon size={18} color="#FF3B30" /> : <MicIcon size={18} color="#fff" />}
    </Pressable>
  );
}

// ─── Text Input Row ────────────────────────────────────────────

function TextInputRow({
  text,
  setText,
  onSend,
  isThinking,
  isArabic,
  theme,
}: {
  text: string;
  setText: (t: string) => void;
  onSend: () => void;
  isThinking: boolean;
  isArabic: boolean;
  theme?: ChatBarTheme;
}) {
  return (
    <View style={styles.inputRow}>
      <TextInput
        style={[
          styles.input,
          isArabic && styles.inputRTL,
          theme?.inputBackgroundColor ? { backgroundColor: theme.inputBackgroundColor } : undefined,
          theme?.textColor ? { color: theme.textColor } : undefined,
        ]}
        placeholder={isArabic ? 'اكتب طلبك...' : 'Ask AI...'}
        placeholderTextColor={theme?.textColor ? `${theme.textColor}66` : '#999'}
        value={text}
        onChangeText={setText}
        onSubmitEditing={onSend}
        returnKeyType="send"
        editable={!isThinking}
        multiline={false}
      />
      <DictationButton
        language={isArabic ? 'ar' : 'en'}
        onTranscript={(t: string) => setText(t)}
        disabled={isThinking}
      />
      <Pressable
        style={[
          styles.sendButton,
          isThinking && styles.sendButtonDisabled,
          theme?.primaryColor ? { backgroundColor: theme.primaryColor } : undefined,
        ]}
        onPress={onSend}
        disabled={isThinking || !text.trim()}
        accessibilityLabel="Send request to AI Agent"
      >
        {isThinking ? <LoadingDots size={18} color={theme?.textColor || '#fff'} /> : <SendArrowIcon size={18} color={theme?.textColor || '#fff'} />}
      </Pressable>
    </View>
  );
}

// ─── Voice Controls Row ────────────────────────────────────────

function VoiceControlsRow({
  isMicActive,
  isSpeakerMuted,
  onMicToggle,
  onSpeakerToggle,
  isAISpeaking,
  isVoiceConnected = false,
  isArabic,
  onStopSession,
}: {
  isMicActive: boolean;
  isSpeakerMuted: boolean;
  onMicToggle: (active: boolean) => void;
  onSpeakerToggle: (muted: boolean) => void;
  isAISpeaking?: boolean;
  isVoiceConnected?: boolean;
  isArabic: boolean;
  onStopSession?: () => void;
}) {
  const isConnecting = !isVoiceConnected;

  return (
    <View style={styles.inputRow}>
      {/* Speaker mute/unmute */}
      <AudioControlButton
        isActive={isSpeakerMuted}
        onPress={() => onSpeakerToggle(!isSpeakerMuted)}
        label={isSpeakerMuted ? 'Unmute speaker' : 'Mute speaker'}
      >
        <SpeakerIcon size={18} color="#fff" muted={isSpeakerMuted} />
      </AudioControlButton>

      {/* Mic button — large center */}
      <Pressable
        style={[
          audioStyles.micButton,
          isConnecting && audioStyles.micButtonConnecting,
          isMicActive && audioStyles.micButtonActive,
          isAISpeaking && audioStyles.micButtonSpeaking,
        ]}
        onPress={() => {
          if (isMicActive) {
            // Stop button: full session cleanup
            onStopSession?.();
          } else if (!isConnecting) {
            // Talk button: start mic
            onMicToggle(true);
          }
        }}
        disabled={isConnecting}
        accessibilityLabel={
          isConnecting ? 'Connecting...' :
          isMicActive ? 'Stop recording' : 'Start recording'
        }
      >
        <View style={audioStyles.micIconWrap}>
          {isConnecting
            ? <LoadingDots size={20} color="#fff" />
            : isAISpeaking
              ? <SpeakerIcon size={20} color="#fff" />
              : isMicActive
                ? <StopIcon size={20} color="#fff" />
                : <MicIcon size={20} color="#fff" />
          }
        </View>
        <Text style={audioStyles.micLabel}>
          {isConnecting
            ? (isArabic ? 'جاري الاتصال...' : 'Connecting...')
            : isAISpeaking
              ? (isArabic ? 'يتحدث...' : 'Speaking...')
              : isMicActive
                ? (isArabic ? 'إيقاف' : 'Stop')
                : (isArabic ? 'تحدث' : 'Talk')}
        </Text>
      </Pressable>

      {/* Connection status indicator */}
      <View style={[
        audioStyles.statusDot,
        isVoiceConnected ? audioStyles.statusDotConnected : audioStyles.statusDotConnecting,
      ]} />
    </View>
  );
}


// ─── Main Component ────────────────────────────────────────────

export function AgentChatBar({
  onSend,
  isThinking,
  lastResult,
  language,
  onDismiss,
  availableModes = ['text'],
  mode = 'text',
  onModeChange,
  onMicToggle,
  onSpeakerToggle,
  isMicActive = false,
  isSpeakerMuted = false,
  isAISpeaking,
  isVoiceConnected,
  onStopSession,
  theme,
  tickets = [],
  selectedTicketId,
  onTicketSelect,
  autoExpandTrigger = 0,
  lastUserMessage,
  unreadCounts = {},
  totalUnread = 0,
}: AgentChatBarProps) {
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const { height } = useWindowDimensions();
  const isArabic = language === 'ar';

  // Auto-expand when triggered (e.g. on escalation)
  useEffect(() => {
    if (autoExpandTrigger > 0) setIsExpanded(true);
  }, [autoExpandTrigger]);

  const pan = useRef(new Animated.ValueXY({ x: 10, y: height - 200 })).current;
  const keyboardOffset = useRef(new Animated.Value(0)).current;

  // ─── Keyboard Handling ──────────────────────────────────────
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardOffset, {
        toValue: -e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? e.duration || 250 : 200,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardOffset]);
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  const handleSend = () => {
    if (text.trim() && !isThinking) {
      onSend(text.trim());
      setText('');
    }
  };

  // ─── HEAVY DEBUG LOGGING ──────────────────────────────────────
  logger.info('ChatBar', '★★★ RENDER — mode:', mode,
    '| selectedTicketId:', selectedTicketId,
    '| tickets:', tickets.length,
    '| availableModes:', availableModes,
    '| lastResult:', lastResult ? lastResult.message.substring(0, 60) : 'null',
    '| isExpanded:', isExpanded);

  // ─── FAB (Compressed) ──────────────────────────────────────

  if (!isExpanded) {
    return (
      <Animated.View
        style={[styles.fabContainer, pan.getLayout()]}
        {...panResponder.panHandlers}
      >
        <Pressable
          style={[styles.fab, theme?.primaryColor ? { backgroundColor: theme.primaryColor } : undefined]}
          onPress={() => setIsExpanded(true)}
          accessibilityLabel={totalUnread > 0 ? `Open AI Agent Chat - ${totalUnread} unread messages` : 'Open AI Agent Chat'}
        >
          {isThinking ? <LoadingDots size={28} color={theme?.textColor || '#fff'} /> : <AIBadge size={28} />}
        </Pressable>
        {/* Unread badge on collapsed FAB */}
        {totalUnread > 0 && (
          <View style={styles.fabUnreadBadge} pointerEvents="none">
            <Text style={styles.fabUnreadBadgeText}>
              {totalUnread > 99 ? '99+' : totalUnread}
            </Text>
          </View>
        )}
      </Animated.View>
    );
  }

  // ─── Expanded Widget ───────────────────────────────────────

  return (
    <Animated.View style={[
      styles.expandedContainer,
      pan.getLayout(),
      { transform: [{ translateY: keyboardOffset }] },
      theme?.backgroundColor ? { backgroundColor: theme.backgroundColor } : undefined,
    ]}>
      {/* Drag Handle */}
      <View {...panResponder.panHandlers} style={styles.dragHandleArea} accessibilityLabel="Drag AI Agent">
        <View style={styles.dragGrip} />
        <Pressable onPress={() => setIsExpanded(false)} style={styles.minimizeBtn} accessibilityLabel="Minimize AI Agent">
          <Text style={styles.minimizeText}>—</Text>
        </Pressable>
      </View>

      {/* Mode Selector */}
      <ModeSelector
        modes={availableModes}
        activeMode={mode}
        onSelect={(m) => onModeChange?.(m)}
        isArabic={isArabic}
        totalUnread={totalUnread}
      />

      {/* Result Bubble — only show in text/voice modes, NOT in human mode */}
      {lastResult && mode !== 'human' && (() => {
        const cleanMessage = lastResult.message.trim();
        return (
        <View style={[
          styles.resultBubble,
          lastResult.success
            ? [styles.resultSuccess, theme?.successColor ? { backgroundColor: theme.successColor } : undefined]
            : [styles.resultError, theme?.errorColor ? { backgroundColor: theme.errorColor } : undefined],
        ]}>
        <ScrollView style={styles.resultScroll} nestedScrollEnabled>
            <Text style={[styles.resultText, { textAlign: isArabic ? 'right' : 'left' }, theme?.textColor ? { color: theme.textColor } : undefined]}>
              {lastUserMessage ?? cleanMessage}
            </Text>
          </ScrollView>
          {onDismiss && (
            <Pressable style={styles.dismissButton} onPress={onDismiss} hitSlop={12}>
              <CloseIcon size={14} color={theme?.textColor ? theme.textColor : 'rgba(255, 255, 255, 0.6)'} />
            </Pressable>
          )}
        </View>
        );
      })()}

      {/* Mode-specific input */}
      {mode === 'text' && (
        <TextInputRow
          text={text}
          setText={setText}
          onSend={handleSend}
          isThinking={isThinking}
          isArabic={isArabic}
          theme={theme}
        />
      )}

      {/* Human mode: ticket list or chat */}
      {mode === 'human' && !selectedTicketId && (
        <ScrollView style={styles.ticketList} nestedScrollEnabled>
          {tickets.length === 0 ? (
            <Text style={styles.emptyText}>No active tickets</Text>
          ) : (
            tickets.map(ticket => {
              const unreadCount = unreadCounts[ticket.id] || 0;
              return (
                <Pressable
                  key={ticket.id}
                  style={styles.ticketCard}
                  onPress={() => onTicketSelect?.(ticket.id)}
                >
                  <View style={styles.ticketTopRow}>
                    <Text style={styles.ticketReason} numberOfLines={2}>
                      {ticket.history.length > 0 ? (ticket.history[ticket.history.length - 1]?.content ?? ticket.reason) : ticket.reason}
                    </Text>
                    {unreadCount > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.ticketMeta}>
                    <Text style={styles.ticketScreen}>{ticket.screen}</Text>
                    <Text style={[styles.ticketStatus, ticket.status === 'open' && styles.statusOpen]}>
                      {ticket.status}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}

      {mode === 'human' && selectedTicketId && null}

      {mode === 'voice' && (
        <VoiceControlsRow
          isMicActive={isMicActive}
          isSpeakerMuted={isSpeakerMuted}
          onMicToggle={onMicToggle || (() => {})}
          onSpeakerToggle={onSpeakerToggle || (() => {})}
          isAISpeaking={isAISpeaking}
          isVoiceConnected={isVoiceConnected}
          isArabic={isArabic}
          onStopSession={onStopSession}
        />
      )}

      {/* Voice controls removed since mode handles it */}

    </Animated.View>
  );
}

// ─── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    zIndex: 9999,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },

  fabIcon: {
    fontSize: 28,
  },
  expandedContainer: {
    position: 'absolute',
    zIndex: 9999,
    width: 340,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderRadius: 24,
    padding: 16,
    paddingTop: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  dragHandleArea: {
    width: '100%',
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  dragGrip: {
    width: 40,
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
  },
  minimizeBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: 8,
  },
  minimizeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultBubble: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  resultSuccess: {
    backgroundColor: 'rgba(40, 167, 69, 0.2)',
  },
  resultError: {
    backgroundColor: 'rgba(220, 53, 69, 0.2)',
  },
  resultText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },

  resultScroll: {
    maxHeight: 200,
    flex: 1,
  },
  dismissButton: {
    marginLeft: 8,
    padding: 2,
  },
  dismissText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: 'bold',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
  },
  inputRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 18,
  },
  dictationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  dictationButtonActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
  },
  ticketList: {
    maxHeight: 260,
    paddingHorizontal: 12,
  },
  ticketCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  ticketTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  ticketReason: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  ticketMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  ticketScreen: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
  ticketStatus: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  statusOpen: {
    color: '#FF9500',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 30,
  },
  backBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtnText: {
    color: '#7B68EE',
    fontSize: 14,
    fontWeight: '600',
  },
  chatMessages: {
    maxHeight: 200,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  msgBubble: {
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
    maxWidth: '85%',
  },
  msgBubbleUser: {
    backgroundColor: 'rgba(123, 104, 238, 0.3)',
    alignSelf: 'flex-end',
  },
  msgBubbleAgent: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'flex-start',
  },
  msgText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
  },
  typingIndicator: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  typingText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    fontStyle: 'italic',
  },
  unreadBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 16,
    textAlign: 'center',
  },
  humanTabBadge: {
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    marginLeft: 3,
  },
  humanTabBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
    lineHeight: 14,
    textAlign: 'center',
  },
  fabUnreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#1a1a2e',
  },
  fabUnreadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
});

const modeStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  tabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  tabIcon: {
    fontSize: 14,
  },
  tabLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#fff',
  },
});

const audioStyles = StyleSheet.create({
  controlBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(255, 100, 100, 0.2)',
  },
  controlIcon: {
    fontSize: 16,
  },
  micButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  micButtonActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
  },
  micButtonSpeaking: {
    backgroundColor: 'rgba(52, 199, 89, 0.3)',
  },
  micIconWrap: {
    width: 20,
    height: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  micLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  micButtonConnecting: {
    backgroundColor: 'rgba(255, 200, 50, 0.2)',
    opacity: 0.7,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusDotConnected: {
    backgroundColor: '#34C759',
  },
  statusDotConnecting: {
    backgroundColor: '#FFCC00',
  },
  humanStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  humanStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF9500',
  },
  humanStatusText: {
    color: '#FF9500',
    fontSize: 13,
    fontWeight: '600',
  },
  ticketList: {
    maxHeight: 260,
    paddingHorizontal: 12,
  },
  ticketCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  ticketReason: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  ticketMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  ticketScreen: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
  ticketStatus: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  statusOpen: {
    color: '#FF9500',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 30,
  },
  backBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtnText: {
    color: '#7B68EE',
    fontSize: 14,
    fontWeight: '600',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backText: {
    color: '#7B68EE',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyTickets: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTicketsText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 14,
  },
});
