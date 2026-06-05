/**
 * AgentOverlay — Subtle thinking indicator shown while the AI agent is processing.
 * Includes a cancel button to stop the agent mid-execution.
 */

import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { CloseIcon } from './Icons';

interface AgentOverlayProps {
  visible: boolean;
  statusText: string;
  onCancel?: () => void;
}

export function AgentOverlay({ visible, statusText, onCancel }: AgentOverlayProps) {
  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.pill}>
        <ActivityIndicator size="small" color="#fff" />
        <Text style={styles.text}>{statusText || 'Thinking...'}</Text>
        {onCancel && (
          <TouchableOpacity
            onPress={onCancel}
            style={styles.cancelButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <CloseIcon size={12} color="#fff" />
          </TouchableOpacity>
        )}
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
    maxWidth: '85%',
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
  cancelButton: {
    marginLeft: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

