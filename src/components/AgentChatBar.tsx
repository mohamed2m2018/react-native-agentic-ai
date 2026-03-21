/**
 * AgentChatBar — Floating, draggable, compressible chat widget.
 * Does not block underlying UI natively.
 */

import { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import type { ExecutionResult } from '../core/types';

interface AgentChatBarProps {
  onSend: (message: string) => void;
  isThinking: boolean;
  lastResult: ExecutionResult | null;
  language: 'en' | 'ar';
  onDismiss?: () => void;
}

export function AgentChatBar({ onSend, isThinking, lastResult, language, onDismiss }: AgentChatBarProps) {
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const { height } = useWindowDimensions();
  const isArabic = language === 'ar';

  // Initial position: Bottom right for FAB, Bottom center for Expanded
  // For simplicity, we just initialize to a safe generic spot on screen.
  const pan = useRef(new Animated.ValueXY({ x: 10, y: height - 200 })).current;

  // PanResponder for dragging the widget
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only trigger drag if moving more than 5px (allows taps to register inside)
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

  // ─── Compressed State (FAB) ───
  if (!isExpanded) {
    return (
      <Animated.View style={[styles.fabContainer, pan.getLayout()]} {...panResponder.panHandlers}>
        <Pressable 
          style={styles.fab} 
          onPress={() => setIsExpanded(true)}
          accessibilityLabel="Open AI Agent Chat"
        >
          <Text style={styles.fabIcon}>{isThinking ? '⏳' : '🤖'}</Text>
        </Pressable>
      </Animated.View>
    );
  }

  // ─── Expanded State (Widget) ───
  return (
    <Animated.View style={[styles.expandedContainer, pan.getLayout()]}>
      {/* Drag Handle Area */}
      <View {...panResponder.panHandlers} style={styles.dragHandleArea} accessibilityLabel="Drag AI Agent">
        <View style={styles.dragGrip} />
        <Pressable onPress={() => setIsExpanded(false)} style={styles.minimizeBtn} accessibilityLabel="Minimize AI Agent">
          <Text style={styles.minimizeText}>—</Text>
        </Pressable>
      </View>

      {/* Result message */}
      {lastResult && (
        <View style={[styles.resultBubble, lastResult.success ? styles.resultSuccess : styles.resultError]}>
          <Text style={styles.resultText}>{lastResult.message}</Text>
          {onDismiss && (
            <Pressable style={styles.dismissButton} onPress={onDismiss} hitSlop={12}>
              <Text style={styles.dismissText}>✕</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Input row */}
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, isArabic && styles.inputRTL]}
          placeholder={isArabic ? 'اكتب طلبك...' : 'Ask AI...'}
          placeholderTextColor="#999"
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          editable={!isThinking}
          multiline={false}
        />
        <Pressable
          style={[styles.sendButton, isThinking && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={isThinking || !text.trim()}
          accessibilityLabel="Send request to AI Agent"
        >
          <Text style={styles.sendButtonText}>
            {isThinking ? '⏳' : '🚀'}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // FAB Styles
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

  // Expanded Styles
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
  
  // Results & Input
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
});
