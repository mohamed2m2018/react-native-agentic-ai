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
import type { ExecutionResult, AgentMode, ChatBarTheme, AIMessage, ConversationSummary } from '../core/types';
import {
  MicIcon,
  SpeakerIcon,
  SendArrowIcon,
  StopIcon,
  LoadingDots,
  AIBadge,
  HistoryIcon,
  NewChatIcon,
  CloseIcon,
} from './Icons';
import type { SupportTicket } from '../support/types';
import { logger } from '../utils/logger';
import { DiscoveryTooltip } from './DiscoveryTooltip';

// ─── Props ─────────────────────────────────────────────────────

interface AgentChatBarProps {
  onSend: (message: string) => void;
  isThinking: boolean;
  statusText?: string;
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
  /** Show first-use discovery tooltip above FAB */
  showDiscoveryTooltip?: boolean;
  /** Custom discovery tooltip copy */
  discoveryTooltipMessage?: string;
  /** Called when discovery tooltip is dismissed */
  onTooltipDismiss?: () => void;
  // ─── Conversation History ──────────────────────────────────
  /** Past conversation sessions fetched from backend */
  conversations?: ConversationSummary[];
  /** True while history is loading from backend */
  isLoadingHistory?: boolean;
  /** Called when user taps a past conversation */
  onConversationSelect?: (conversationId: string) => void;
  /** Called when user starts a new conversation */
  onNewConversation?: () => void;
  pendingApprovalQuestion?: string | null;
  onPendingApprovalAction?: (action: 'approve' | 'reject') => void;
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
  const inputRef = useRef<any>(null);

  const handleSendWithClear = () => {
    onSend();
    // Imperatively clear the native TextInput — controlled `value=''` can be
    // ignored by the iOS native layer when editable flips to false in the same
    // render batch.
    inputRef.current?.clear();
  };

  return (
    <View style={styles.inputRow}>
      <TextInput
        ref={inputRef}
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
        onSubmitEditing={handleSendWithClear}
        returnKeyType="default"
        blurOnSubmit={false}
        editable={!isThinking}
        multiline={true}
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
        onPress={handleSendWithClear}
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
  statusText,
  lastResult,
  language,
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
  unreadCounts = {},
  totalUnread = 0,
  showDiscoveryTooltip = false,
  discoveryTooltipMessage,
  onTooltipDismiss,
  chatMessages = [],
  conversations = [],
  isLoadingHistory = false,
  onConversationSelect,
  onNewConversation,
  pendingApprovalQuestion,
  onPendingApprovalAction,
}: AgentChatBarProps) {
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [localUnread, setLocalUnread] = useState(0);
  const [fabX, setFabX] = useState(10);
  const [showHistory, setShowHistory] = useState(false);
  const prevMsgCount = useRef(chatMessages.length);
  const scrollRef = useRef<any>(null);
  const { height, width } = useWindowDimensions();
  const isArabic = language === 'ar';
  const [panelHeight, setPanelHeight] = useState(0);
  const preKeyboardYRef = useRef<number | null>(null);
  const previousThinkingRef = useRef(false);
  const autoCollapsedForThinkingRef = useRef(false);

  // Track incoming AI messages while collapsed
  useEffect(() => {
    if (chatMessages.length > prevMsgCount.current && !isExpanded) {
      setLocalUnread(prev => prev + (chatMessages.length - prevMsgCount.current));
    }
    prevMsgCount.current = chatMessages.length;
  }, [chatMessages.length, isExpanded]);

  const displayUnread = totalUnread + localUnread;

  // Auto-expand when triggered (e.g. on escalation)
  useEffect(() => {
    if (autoExpandTrigger > 0) setIsExpanded(true);
  }, [autoExpandTrigger]);

  useEffect(() => {
    const wasThinking = previousThinkingRef.current;

    if (!wasThinking && isThinking && mode === 'text' && !pendingApprovalQuestion) {
      if (isExpanded) {
        setIsExpanded(false);
        autoCollapsedForThinkingRef.current = true;
      } else {
        autoCollapsedForThinkingRef.current = false;
      }
    }

    if (pendingApprovalQuestion) {
      setIsExpanded(true);
      autoCollapsedForThinkingRef.current = false;
    }

    if (wasThinking && !isThinking) {
      autoCollapsedForThinkingRef.current = false;
    }

    previousThinkingRef.current = isThinking;
  }, [isThinking, isExpanded, mode, pendingApprovalQuestion]);

  const pan = useRef(new Animated.ValueXY({ x: 10, y: height - 200 })).current;
  const tooltipSide = fabX < width / 2 ? 'right' : 'left';

  useEffect(() => {
    const listenerId = pan.x.addListener(({ value }) => {
      setFabX(value);
    });

    return () => {
      pan.x.removeListener(listenerId);
    };
  }, [pan.x]);

  // ─── Keyboard Handling ──────────────────────────────────────
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const keyboardMargin = 12;

    const showSub = Keyboard.addListener(showEvent, (e) => {
      if (!isExpanded || mode !== 'text' || panelHeight <= 0) return;

      pan.y.stopAnimation((currentY: number) => {
        const targetY = Math.max(
          keyboardMargin,
          height - e.endCoordinates.height - panelHeight - keyboardMargin
        );

        // Preserve the pre-keyboard position so we can restore it on hide.
        preKeyboardYRef.current = currentY;

        // Only lift the widget if the keyboard would overlap it.
        if (currentY <= targetY) return;

        Animated.timing(pan.y, {
          toValue: targetY,
          duration: Platform.OS === 'ios' ? e.duration || 250 : 200,
          useNativeDriver: false,
        }).start();
      });
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      const restoreY = preKeyboardYRef.current;
      if (restoreY == null) return;

      preKeyboardYRef.current = null;
      Animated.timing(pan.y, {
        toValue: restoreY,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [height, isExpanded, mode, pan.y, panelHeight]);
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
          onPress={() => {
            onTooltipDismiss?.();
            setLocalUnread(0);
            autoCollapsedForThinkingRef.current = false;
            setIsExpanded(true);
          }}
          accessibilityLabel={displayUnread > 0 ? `Open AI Agent Chat - ${displayUnread} unread messages` : 'Open AI Agent Chat'}
        >
          {isThinking ? <LoadingDots size={28} color={theme?.textColor || '#fff'} /> : <AIBadge size={28} />}
        </Pressable>
        {/* Discovery tooltip — shows above FAB on first use */}
        {showDiscoveryTooltip && (
          <DiscoveryTooltip
            language={language}
            primaryColor={theme?.primaryColor}
            message={discoveryTooltipMessage}
            side={tooltipSide}
            onDismiss={() => onTooltipDismiss?.()}
          />
        )}
        {/* Unread popup bubble with message preview */}
        {localUnread > 0 && chatMessages.length > 0 && (
          <Pressable 
            style={[styles.unreadPopup, isArabic ? styles.unreadPopupRTL : styles.unreadPopupLTR]} 
            onPress={() => {
              onTooltipDismiss?.();
              setLocalUnread(0);
              setIsExpanded(true);
            }}
          >
             <Text style={[styles.unreadPopupText, { textAlign: isArabic ? 'right' : 'left' }]} numberOfLines={2}>
               {(() => {
                  const lastMsg = [...chatMessages].reverse().find(m => m.role === 'assistant');
                  if (!lastMsg) return isArabic ? 'رسالة جديدة' : 'New message';
                  const content = Array.isArray(lastMsg.content) 
                    ? lastMsg.content.map(c => c.type === 'text' ? c.text : '').join('')
                    : lastMsg.content;
                  return content || (isArabic ? 'رسالة جديدة' : 'New message');
               })()}
             </Text>
             {/* Unread badge sits gracefully on the corner of the popup */}
             {displayUnread > 1 && (
                <View style={[styles.fabUnreadBadge, styles.popupBadgeOverride]} pointerEvents="none">
                  <Text style={styles.fabUnreadBadgeText}>
                    {displayUnread > 99 ? '99+' : displayUnread}
                  </Text>
                </View>
             )}
          </Pressable>
        )}

        {/* Thinking status bubble */}
        {isThinking && !pendingApprovalQuestion && (
          <Pressable
            style={[styles.statusPopup, isArabic ? styles.unreadPopupRTL : styles.unreadPopupLTR]}
            onPress={() => {
              autoCollapsedForThinkingRef.current = false;
              setIsExpanded(true);
            }}
          >
            <LoadingDots size={14} color="#111827" />
            <Text style={[styles.statusPopupText, { textAlign: isArabic ? 'right' : 'left' }]} numberOfLines={2}>
              {statusText || (isArabic ? 'جاري التنفيذ...' : 'Working...')}
            </Text>
          </Pressable>
        )}
        
        {/* Fallback Unread badge on collapsed FAB if we only have human unread, no local AI unread */}
        {displayUnread > 0 && localUnread === 0 && (
          <View style={styles.fabUnreadBadge} pointerEvents="none">
            <Text style={styles.fabUnreadBadgeText}>
              {displayUnread > 99 ? '99+' : displayUnread}
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
      { maxHeight: height * 0.65 },
      theme?.backgroundColor ? { backgroundColor: theme.backgroundColor } : undefined,
    ]}
      onLayout={(event) => {
        const nextHeight = event.nativeEvent.layout.height;
        if (Math.abs(nextHeight - panelHeight) > 1) {
          setPanelHeight(nextHeight);
        }
      }}
    >
      {/* Drag Handle */}
      <View {...panResponder.panHandlers} style={styles.dragHandleArea} accessibilityLabel="Drag AI Agent">
        <View style={styles.dragGrip} />
      </View>
      <Pressable onPress={() => { setIsExpanded(false); setShowHistory(false); }} style={styles.minimizeBtn} accessibilityLabel="Minimize AI Agent">
        <Text style={styles.minimizeText}>—</Text>
      </Pressable>

      {/* History button — shown whenever conversation history is enabled (top-left of widget) */}
      {onConversationSelect && !showHistory && (
        <View style={historyStyles.headerActions}>
          <Pressable
            style={historyStyles.historyBtn}
            onPress={() => setShowHistory(true)}
            accessibilityLabel="View conversation history"
            hitSlop={8}
          >
            <HistoryIcon size={18} color="rgba(255,255,255,0.55)" />
            {conversations.length > 0 && (
              <View style={historyStyles.historyCountBadge}>
                <Text style={historyStyles.historyCountBadgeText}>
                  {conversations.length > 9 ? '9+' : conversations.length}
                </Text>
              </View>
            )}
          </Pressable>

          {onNewConversation && (
            <Pressable
              style={historyStyles.quickNewBtn}
              onPress={onNewConversation}
              accessibilityLabel="Start new conversation"
              hitSlop={8}
            >
              <Text style={historyStyles.quickNewBtnText}>+</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Corner drag zones — same panResponder, all 4 corners are draggable */}
      <View {...panResponder.panHandlers} style={[styles.cornerHandle, styles.cornerTL]} pointerEvents="box-only">
        <View style={[styles.cornerIndicator, styles.cornerIndicatorTL]} />
      </View>
      <View {...panResponder.panHandlers} style={[styles.cornerHandle, styles.cornerTR]} pointerEvents="box-only">
        <View style={[styles.cornerIndicator, styles.cornerIndicatorTR]} />
      </View>
      <View {...panResponder.panHandlers} style={[styles.cornerHandle, styles.cornerBL]} pointerEvents="box-only">
        <View style={[styles.cornerIndicator, styles.cornerIndicatorBL]} />
      </View>
      <View {...panResponder.panHandlers} style={[styles.cornerHandle, styles.cornerBR]} pointerEvents="box-only">
        <View style={[styles.cornerIndicator, styles.cornerIndicatorBR]} />
      </View>

      {/* Mode Selector */}
      {!showHistory && (
        <ModeSelector
          modes={availableModes}
          activeMode={mode}
          onSelect={(m) => onModeChange?.(m)}
          isArabic={isArabic}
          totalUnread={totalUnread}
        />
      )}

      {/* ─── HISTORY PANEL ────────────────────────────────────────── */}
      {showHistory && (
        <View style={historyStyles.panel}>
          <View style={historyStyles.headerRow}>
            <Pressable
              style={historyStyles.backBtn}
              onPress={() => setShowHistory(false)}
              accessibilityLabel="Back to chat"
              hitSlop={8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <CloseIcon size={13} color="#7B68EE" />
                <Text style={historyStyles.backBtnText}>Back</Text>
              </View>
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <HistoryIcon size={15} color="rgba(255,255,255,0.7)" />
              <Text style={historyStyles.headerTitle}>History</Text>
            </View>
            <Pressable
              style={historyStyles.newBtn}
              onPress={() => { onNewConversation?.(); setShowHistory(false); }}
              accessibilityLabel="Start new conversation"
              hitSlop={8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <NewChatIcon size={14} color="#7B68EE" />
                <Text style={historyStyles.newBtnText}>New</Text>
              </View>
            </Pressable>
          </View>

          {isLoadingHistory && conversations.length === 0 && (
            <View style={historyStyles.shimmerWrap}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={historyStyles.shimmerCard}>
                  <View style={[historyStyles.shimmerLine, { width: '70%' }]} />
                  <View style={[historyStyles.shimmerLine, { width: '45%', marginTop: 6, opacity: 0.5 }]} />
                </View>
              ))}
            </View>
          )}

          {!isLoadingHistory && conversations.length === 0 && (
            <View style={historyStyles.emptyWrap}>
              <HistoryIcon size={36} color="rgba(255,255,255,0.25)" />
              <Text style={historyStyles.emptyTitle}>No previous conversations</Text>
              <Text style={historyStyles.emptySubtitle}>Your AI conversations will appear here</Text>
            </View>
          )}

          {conversations.length > 0 && (
            <ScrollView
              style={{ maxHeight: height * 0.65 - 130 }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {conversations.map((conv) => {
                const relativeDate = getRelativeDate(conv.updatedAt);
                return (
                  <Pressable
                    key={conv.id}
                    style={({ pressed }) => [
                      historyStyles.convCard,
                      pressed && historyStyles.convCardPressed,
                    ]}
                    onPress={() => { onConversationSelect?.(conv.id); setShowHistory(false); }}
                    accessibilityLabel={`Load conversation: ${conv.title}`}
                  >
                    <View style={historyStyles.convCardTop}>
                      <Text style={historyStyles.convTitle} numberOfLines={1}>{conv.title}</Text>
                      <View style={historyStyles.convMsgBadge}>
                        <Text style={historyStyles.convMsgBadgeText}>{conv.messageCount}</Text>
                      </View>
                    </View>
                    <Text style={historyStyles.convPreview} numberOfLines={1}>
                      {conv.preview || 'No messages'}
                    </Text>
                    <Text style={historyStyles.convDate}>{relativeDate}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* ─── NORMAL CHAT UI ────────────────────────────────────────── */}
      {!showHistory && (
        <>
          {mode !== 'human' && chatMessages.length > 0 && (
            <ScrollView
              style={[styles.messageList, { maxHeight: height * 0.65 - 178 }]}
              nestedScrollEnabled
              ref={scrollRef}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              {chatMessages.filter(msg => msg.role === 'user' || msg.role === 'assistant').map((msg) => {
                const isUser = msg.role === 'user';
                const contentText = Array.isArray(msg.content)
                  ? msg.content.map((c: any) => c.type === 'text' ? c.text : '').join('')
                  : msg.content;
                if (!contentText || contentText.trim() === '') return null;
                return (
                  <View
                    key={msg.id || `${msg.role}-${Math.random()}`}
                    style={[
                      styles.messageBubble,
                      isUser ? styles.messageBubbleUser : styles.messageBubbleAI,
                      isUser && theme?.primaryColor ? { backgroundColor: theme.primaryColor } : undefined,
                    ]}
                  >
                    <Text style={[
                      styles.messageText,
                      isUser ? styles.messageTextUser : styles.messageTextAI,
                      { textAlign: isArabic ? 'right' : 'left' },
                    ]}>
                      {contentText}
                    </Text>
                  </View>
                );
              })}
              {isThinking && (
                <View style={[styles.messageBubble, styles.messageBubbleAI]}>
                  <LoadingDots size={18} color="#fff" />
                </View>
              )}
            </ScrollView>
          )}

          {mode === 'text' && (
            <>
              {pendingApprovalQuestion && onPendingApprovalAction && (
                <View style={styles.approvalPanel}>
                  <Text style={styles.approvalHint}>
                    I can do this in the app for you by tapping and typing where needed, or I can guide you step by step. Tap "Do it" if you want me to do it in the app, or "Don’t do it" if you’d rather do it yourself.
                  </Text>
                  <View style={styles.approvalActions}>
                    <Pressable
                      style={[styles.approvalActionBtn, styles.approvalActionSecondary]}
                      onPress={() => onPendingApprovalAction('reject')}
                    >
                      <Text style={[styles.approvalActionText, styles.approvalActionSecondaryText]}>Don’t do it</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.approvalActionBtn, styles.approvalActionPrimary]}
                      onPress={() => onPendingApprovalAction('approve')}
                    >
                      <Text style={[styles.approvalActionText, styles.approvalActionPrimaryText]}>Do it</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              <TextInputRow
                text={text}
                setText={setText}
                onSend={handleSend}
                isThinking={isThinking}
                isArabic={isArabic}
                theme={theme}
              />
            </>
          )}

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
        </>
      )}

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
  unreadPopup: {
    position: 'absolute',
    bottom: 70, // Float above the FAB
    left: -70,  // Centered over a 60px FAB
    width: 200,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  unreadPopupLTR: {
    borderBottomLeftRadius: 4,
  },
  unreadPopupRTL: {
    borderBottomRightRadius: 4,
  },
  unreadPopupText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  statusPopup: {
    position: 'absolute',
    bottom: 70,
    left: -70,
    width: 220,
    minHeight: 48,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPopupText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    flex: 1,
  },
  popupBadgeOverride: {
    top: -8,
    right: -8,
    borderColor: '#fff',
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
    padding: 12,
    zIndex: 20, // ensure it sits above the drag corner
  },
  minimizeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // ── Corner drag handles ────────────────────────────────────────
  cornerHandle: {
    position: 'absolute',
    width: 32,
    height: 32,
    zIndex: 10,
  },
  cornerTL: { top: 0, left: 0 },
  cornerTR: { top: 0, right: 0 },
  cornerBL: { bottom: 0, left: 0 },
  cornerBR: { bottom: 0, right: 0 },
  // Subtle L-shaped indicator so users know the corners are draggable
  cornerIndicator: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  cornerIndicatorTL: { top: 6, left: 6, width: 10, height: 2, borderTopLeftRadius: 1 },
  cornerIndicatorTR: { top: 6, right: 6, width: 10, height: 2, borderTopRightRadius: 1 },
  cornerIndicatorBL: { bottom: 6, left: 6, width: 10, height: 2, borderBottomLeftRadius: 1 },
  cornerIndicatorBR: { bottom: 6, right: 6, width: 10, height: 2, borderBottomRightRadius: 1 },
  messageList: {
    marginBottom: 12,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    maxWidth: '85%',
  },
  messageBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#7B68EE',
    borderBottomRightRadius: 4,
  },
  messageBubbleAI: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextUser: {
    color: '#fff',
  },
  messageTextAI: {
    color: '#fff', // Or slightly off-white for contrast
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
    alignItems: 'flex-end',
    gap: 8,
    justifyContent: 'center',
    paddingBottom: 2, // Slight padding so buttons don't clip against bottom edge
  },
  approvalPanel: {
    marginBottom: 10,
    gap: 8,
  },
  approvalHint: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  approvalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  approvalActionBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  approvalActionPrimary: {
    backgroundColor: '#7B68EE',
  },
  approvalActionNeutral: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  approvalActionSecondary: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  approvalActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  approvalActionPrimaryText: {
    color: '#ffffff',
  },
  approvalActionSecondaryText: {
    color: 'rgba(255,255,255,0.82)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    color: '#fff',
    fontSize: 16,
    minHeight: 48,
    maxHeight: 120, // wrap up to ~5 lines before scrolling internal
  },
  inputRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    width: 44,
    height: 44,
    borderRadius: 22,
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
// ─── Relative Date Helper ────────────────────────────────────────────────────

function getRelativeDate(timestampMs: number): string {
  const now = Date.now();
  const diff = now - timestampMs;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return new Date(timestampMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── History Styles ───────────────────────────────────────────────────────

const historyStyles = StyleSheet.create({
  headerActions: {
    position: 'absolute',
    left: 16,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 20,
  },
  // ─ History trigger button
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  quickNewBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickNewBtnText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 18,
    lineHeight: 18,
    fontWeight: '500',
    marginTop: -1,
  },
  historyCountBadge: {
    marginLeft: 3,
    backgroundColor: 'rgba(123,104,238,0.8)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  historyCountBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },

  // ─ Panel container
  panel: {
    flex: 1,
  },

  // ─ Header row (Back | History | + New)
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  backBtn: {
    padding: 4,
  },
  backBtnText: {
    color: '#7B68EE',
    fontSize: 13,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  newBtn: {
    backgroundColor: 'rgba(123,104,238,0.25)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  newBtnText: {
    color: '#7B68EE',
    fontSize: 12,
    fontWeight: '700',
  },

  // ─ Shimmer loading cards
  shimmerWrap: {
    gap: 8,
  },
  shimmerCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 14,
    height: 64,
    justifyContent: 'center',
  },
  shimmerLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  // ─ Empty state
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 6,
  },
  emptyTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    textAlign: 'center',
  },

  // ─ Conversation cards
  convCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  convCardPressed: {
    backgroundColor: 'rgba(123,104,238,0.18)',
    borderColor: 'rgba(123,104,238,0.3)',
  },
  convCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  convTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  convMsgBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  convMsgBadgeText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '600',
  },
  convPreview: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  convDate: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '500',
  },
});
