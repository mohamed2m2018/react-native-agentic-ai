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
import type { ExecutionResult, AgentMode } from '../core/types';
import {
  MicIcon,
  SpeakerIcon,
  SendArrowIcon,
  StopIcon,
  LoadingDots,
  AIBadge,
} from './Icons';

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
  /** Full session cleanup (stop mic, audio, WebSocket, live mode) */
  onStopSession?: () => void;
}

// ─── Mode Selector ─────────────────────────────────────────────

function ModeSelector({
  modes,
  activeMode,
  onSelect,
}: {
  modes: AgentMode[];
  activeMode: AgentMode;
  onSelect: (mode: AgentMode) => void;
}) {
  if (modes.length <= 1) return null;

  const labels: Record<AgentMode, { label: string }> = {
    text: { label: 'Text' },
    voice: { label: 'Live Agent' },
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
              backgroundColor: mode === 'voice' ? '#34C759' : '#7B68EE',
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
}: {
  text: string;
  setText: (t: string) => void;
  onSend: () => void;
  isThinking: boolean;
  isArabic: boolean;
}) {
  return (
    <View style={styles.inputRow}>
      <TextInput
        style={[styles.input, isArabic && styles.inputRTL]}
        placeholder={isArabic ? 'اكتب طلبك...' : 'Ask AI...'}
        placeholderTextColor="#999"
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
        style={[styles.sendButton, isThinking && styles.sendButtonDisabled]}
        onPress={onSend}
        disabled={isThinking || !text.trim()}
        accessibilityLabel="Send request to AI Agent"
      >
        {isThinking ? <LoadingDots size={18} color="#fff" /> : <SendArrowIcon size={18} color="#fff" />}
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
}: AgentChatBarProps) {
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const { height } = useWindowDimensions();
  const isArabic = language === 'ar';

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

  // ─── FAB (Compressed) ──────────────────────────────────────

  if (!isExpanded) {
    return (
      <Animated.View
        style={[styles.fabContainer, pan.getLayout()]}
        {...panResponder.panHandlers}
      >
        <Pressable
          style={styles.fab}
          onPress={() => setIsExpanded(true)}
          accessibilityLabel="Open AI Agent Chat"
        >
          {isThinking ? <LoadingDots size={28} color="#fff" /> : <AIBadge size={28} />}
        </Pressable>
      </Animated.View>
    );
  }

  // ─── Expanded Widget ───────────────────────────────────────

  return (
    <Animated.View style={[styles.expandedContainer, pan.getLayout(), { transform: [{ translateY: keyboardOffset }] }]}>
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
      />

      {/* Result Bubble */}
      {lastResult && (
        <View style={[styles.resultBubble, lastResult.success ? styles.resultSuccess : styles.resultError]}>
          <ScrollView style={styles.resultScroll} nestedScrollEnabled>
            <Text style={styles.resultText}>{lastResult.message}</Text>
          </ScrollView>
          {onDismiss && (
            <Pressable style={styles.dismissButton} onPress={onDismiss} hitSlop={12}>
              <Text style={styles.dismissText}>✕</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Mode-specific input */}
      {mode === 'text' && (
        <TextInputRow
          text={text}
          setText={setText}
          onSend={handleSend}
          isThinking={isThinking}
          isArabic={isArabic}
        />
      )}

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
});
