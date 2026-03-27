/**
 * Chat tab — demonstrates useAI() bridge hook.
 *
 * <AIAgent> lives in _layout.tsx (root). This screen uses useAI()
 * to get send/isLoading/status from the same runtime — no duplicate agent.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
// import { useAI, type AIMessage } from 'experimental-stuff'; // old
import { useAI, type AIMessage } from '@mobileai/react-native';

import { useRouter } from 'expo-router';

export default function ChatScreen() {
  const router = useRouter();
  const { send, isLoading, status, messages } = useAI({
    enableUIControl: false,
    onResult: () => {
      // Navigate to chat tab after agent completes tasks launched from here
      router.push('/(tabs)/chat');
    }
  });
  const [input, setInput] = useState('');

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');

    // Send to the agent (via AIAgent's runtime)
    send(text);
  };



  const renderMessage = ({ item }: { item: AIMessage }) => (
    <View style={[
      chatStyles.bubble,
      item.role === 'user' ? chatStyles.userBubble : chatStyles.assistantBubble,
    ]}>
      <Text style={[
        chatStyles.bubbleText,
        item.role === 'user' ? chatStyles.userText : chatStyles.assistantText,
      ]}>
        {item.content}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={chatStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={chatStyles.list}
        inverted={false}
      />

      {/* Status bar (while agent is working) */}
      {isLoading && (
        <View style={chatStyles.statusBar}>
          <Text style={chatStyles.statusText}>{status || 'Thinking...'}</Text>
        </View>
      )}

      {/* Input */}
      <View style={chatStyles.inputRow}>
        <TextInput
          style={chatStyles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Try: go to profile, tap settings..."
          placeholderTextColor="#999"
          onSubmitEditing={handleSend}
          editable={!isLoading}
          returnKeyType="send"
        />
        <Pressable
          style={[chatStyles.sendBtn, isLoading && chatStyles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={isLoading}
        >
          <Text style={chatStyles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const chatStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  list: {
    padding: 16,
    gap: 8,
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#6C5CE7',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userText: {
    color: '#fff',
  },
  assistantText: {
    color: '#333',
  },
  statusBar: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: '#f0f0f0',
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#333',
  },
  sendBtn: {
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 20,
    borderRadius: 22,
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
