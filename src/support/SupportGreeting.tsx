/**
 * Support Greeting & Quick Replies — shown when chat opens in support mode.
 *
 * Renders a welcome message with an avatar and quick reply buttons
 * that pre-fill the user's first message.
 */


import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
} from 'react-native';
import type { SupportModeConfig } from './types';

interface SupportGreetingProps {
  config: SupportModeConfig;
  onQuickReply: (message: string) => void;
  theme?: {
    primaryColor?: string;
    textColor?: string;
    backgroundColor?: string;
  };
}

export function SupportGreeting({
  config,
  onQuickReply,
  theme,
}: SupportGreetingProps) {
  const greeting = config.greeting;
  const quickReplies = config.quickReplies ?? [];

  if (!greeting) return null;

  const primary = theme?.primaryColor ?? '#8b5cf6';
  const textColor = theme?.textColor ?? '#ffffff';
  const bgColor = theme?.backgroundColor ?? 'rgba(26, 26, 46, 0.95)';

  return (
    <View style={styles.container}>
      {/* Avatar + Agent Name */}
      <View style={styles.header}>
        {greeting.avatarUrl ? (
          <Image
            source={{ uri: greeting.avatarUrl }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: primary }]}>
            <Text style={styles.avatarEmoji}>🤖</Text>
          </View>
        )}
        {greeting.agentName && (
          <Text style={[styles.agentName, { color: textColor }]}>
            {greeting.agentName}
          </Text>
        )}
      </View>

      {/* Greeting Message */}
      <View style={[styles.messageBubble, { backgroundColor: bgColor }]}>
        <Text style={[styles.messageText, { color: textColor }]}>
          {greeting.message}
        </Text>
      </View>

      {/* Quick Replies */}
      {quickReplies.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickRepliesContainer}
        >
          {quickReplies.map((reply, index) => (
            <TouchableOpacity
              key={`qr-${index}`}
              style={[styles.quickReplyButton, { borderColor: primary }]}
              onPress={() => onQuickReply(reply.message ?? reply.label)}
              activeOpacity={0.7}
            >
              {reply.icon && (
                <Text style={styles.quickReplyIcon}>{reply.icon}</Text>
              )}
              <Text style={[styles.quickReplyText, { color: primary }]}>
                {reply.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 18,
  },
  agentName: {
    fontSize: 14,
    fontWeight: '600',
  },
  messageBubble: {
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    maxWidth: '85%',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  quickRepliesContainer: {
    gap: 8,
    paddingVertical: 4,
  },
  quickReplyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickReplyIcon: {
    fontSize: 14,
  },
  quickReplyText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
