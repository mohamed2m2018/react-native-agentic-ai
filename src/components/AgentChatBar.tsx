/**
 * AgentChatBar — Floating chat input at the bottom of the screen.
 * User sends messages here, and results are shown inline.
 */

import { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
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
  const isArabic = language === 'ar';

  const handleSend = () => {
    if (text.trim() && !isThinking) {
      onSend(text.trim());
      setText('');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {/* Result message */}
      {lastResult && (
        <View style={[styles.resultBubble, lastResult.success ? styles.resultSuccess : styles.resultError]}>
          <Text style={styles.resultText}>{lastResult.message}</Text>
          {onDismiss && (
            <Pressable style={styles.dismissButton} onPress={onDismiss} hitSlop={8}>
              <Text style={styles.dismissText}>✕</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Input row */}
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, isArabic && styles.inputRTL]}
          placeholder={isArabic ? 'اكتب طلبك...' : 'Ask the AI agent...'}
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
        >
          <Text style={styles.sendButtonText}>
            {isThinking ? '⏳' : '🚀'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
    paddingTop: 8,
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  resultBubble: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
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
    fontSize: 16,
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
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
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
    fontSize: 20,
  },
});
