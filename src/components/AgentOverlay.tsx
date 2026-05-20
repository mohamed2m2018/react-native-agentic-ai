/**
 * AgentOverlay — Subtle thinking indicator shown while the AI agent is processing.
 */

import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface AgentOverlayProps {
  visible: boolean;
  statusText: string;
}

export function AgentOverlay({ visible, statusText }: AgentOverlayProps) {
  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <View style={styles.pill}>
        <ActivityIndicator size="small" color="#fff" />
        <Text style={styles.text}>{statusText || 'Thinking...'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
