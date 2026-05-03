import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAI, type AIMessage } from '@mobileai/react-native';

import { getSupportContext, type OrderIssueType, type SupportEscalationContext } from '@/app/lib/delivery-demo';

const QUICK_ACTIONS: { id: OrderIssueType; label: string }[] = [
  { id: 'late-delivery', label: 'Where is my order?' },
  { id: 'missing-item', label: 'Missing item' },
  { id: 'wrong-item', label: 'Wrong item' },
  { id: 'refund-request', label: 'Request refund' },
  { id: 'delivery-instructions', label: 'Change delivery instructions' },
  { id: 'allergy-safety', label: 'Food allergy or safety' },
];

function buildSeedMessage(params: { orderId?: string; issueType?: OrderIssueType; restaurant?: string }): string {
  if (!params.orderId) return '';
  if (params.issueType === 'late-delivery') {
    return `Need support on order ${params.orderId} from ${params.restaurant ?? 'DashBite'}. Order is marked late.`;
  }
  if (params.issueType === 'missing-item') {
    return `Help with order ${params.orderId} from ${params.restaurant ?? 'DashBite'}: an item is missing from the package.`;
  }
  if (params.issueType === 'wrong-item') {
    return `Need help with order ${params.orderId} from ${params.restaurant ?? 'DashBite'}: wrong item received.`;
  }
  if (params.issueType === 'refund-request' || params.issueType === 'duplicate-charge') {
    return `Support request for order ${params.orderId} from ${params.restaurant ?? 'DashBite'}: refund or charge issue.`;
  }
  if (params.issueType === 'allergy-safety') {
    return `Urgent support for order ${params.orderId} from ${params.restaurant ?? 'DashBite'}: possible food allergy/safety concern.`;
  }
  if (params.issueType === 'delivery-instructions') {
    return `Need to update delivery instructions for order ${params.orderId}.`;
  }
  return `Support request for order ${params.orderId} from ${params.restaurant ?? 'DashBite'}.`;
}

function buildMessageForAction(context: SupportEscalationContext | null, issueType: OrderIssueType): string {
  if (!context?.orderId) {
    return `Support question about ${issueType}.`;
  }
  if (issueType === 'late-delivery') {
    return `Issue: ${issueType}. Order ${context.orderId} at ${context.restaurant}. ETA drift: ${context.etaDelta ?? 0}m.`;
  }
  return `Issue: ${issueType}. Order ${context.orderId}, status ${context.status}.`;
}

function messageToText(message: AIMessage): string {
  if (message.previewText) return message.previewText;
  return message.content
    .map((node) => {
      if (node.type === 'text') return node.content;
      const props = node.props || {};
      return [
        typeof props.title === 'string' ? props.title : '',
        typeof props.subtitle === 'string' ? props.subtitle : '',
        typeof props.description === 'string' ? props.description : '',
        typeof props.body === 'string' ? props.body : '',
      ].filter(Boolean).join('\n');
    })
    .filter(Boolean)
    .join('\n');
}

export default function SupportScreen() {
  const params = useLocalSearchParams<{
    orderId?: string;
    issueType?: OrderIssueType;
    restaurant?: string;
    screen?: string;
  }>();
  const [input, setInput] = useState('');
  const [hasSeeded, setHasSeeded] = useState(false);
  const { send, isLoading, status, messages } = useAI({
    enableUIControl: false,
  });
  const contextFromRoute = useMemo(() => {
    const localContext = getSupportContext();
    return {
      orderId: params.orderId ?? localContext?.orderId,
      issueType: params.issueType ?? localContext?.issueType,
      restaurant: params.restaurant ?? localContext?.restaurant,
      screen: params.screen ?? localContext?.screen,
      source: localContext?.source,
    };
  }, [params.issueType, params.orderId, params.restaurant, params.screen]);

  useEffect(() => {
    if (hasSeeded) return;
    const seed = buildSeedMessage(contextFromRoute);
    if (!seed) return;
    send(seed);
    setHasSeeded(true);
    setInput('');
  }, [contextFromRoute, hasSeeded, send]);

  const handleQuickAction = (issueType: OrderIssueType) => {
    const seededMessage = buildMessageForAction(getSupportContext(), issueType);
    send(seededMessage);
  };

  const renderMessage = ({ item }: { item: AIMessage }) => (
    <View style={[
      styles.bubble,
      item.role === 'user' ? styles.userBubble : styles.assistantBubble,
    ]}>
      <Text style={[
        styles.messageText,
        item.role === 'user' ? styles.userText : styles.assistantText,
      ]}>
        {messageToText(item)}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.quickContainer}>
            <Text style={styles.title}>Support Assistant</Text>
            {contextFromRoute.orderId ? (
              <Text style={styles.orderLine}>
                Order {contextFromRoute.orderId} • {contextFromRoute.screen ?? 'Support tab'}
              </Text>
            ) : (
              <Text style={styles.orderLine}>Ask about discovery, your active order, or post-order issues.</Text>
            )}
            <View style={styles.quickActions}>
              {QUICK_ACTIONS.map((action) => (
                <Pressable key={action.id} style={styles.quickBtn} onPress={() => handleQuickAction(action.id)}>
                  <Text style={styles.quickText}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
      />

      {isLoading && (
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>{status || 'Thinking…'}</Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Type your support question..."
          placeholderTextColor="#94A3B8"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => {
            if (input.trim()) {
              send(input.trim());
              setInput('');
            }
          }}
          editable={!isLoading}
          returnKeyType="send"
        />
        <Pressable
          style={[styles.sendBtn, isLoading && styles.disabledBtn]}
          onPress={() => {
            if (!input.trim() || isLoading) return;
            send(input);
            setInput('');
          }}
          disabled={isLoading}
        >
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  list: { padding: 16, gap: 10 },
  quickContainer: { marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  orderLine: { color: '#64748B', marginBottom: 12 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn: {
    backgroundColor: '#DBEAFE',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  quickText: { color: '#1D4ED8', fontWeight: '600', fontSize: 13 },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#4F46E5',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  messageText: { fontSize: 15, lineHeight: 21 },
  userText: { color: '#fff' },
  assistantText: { color: '#1F2937' },
  statusBar: {
    backgroundColor: '#312E81',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  statusText: { color: '#fff', fontWeight: '600', textAlign: 'center', fontSize: 13 },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  input: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    minHeight: 40,
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  disabledBtn: { opacity: 0.5 },
  sendText: { color: '#fff', fontWeight: '700' },
});
