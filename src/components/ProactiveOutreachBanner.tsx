import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ProactiveOutreachBannerProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  style?: object;
}

export function ProactiveOutreachBanner({ message, actionLabel, onAction, onDismiss, style }: ProactiveOutreachBannerProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.actions}>
        {actionLabel && onAction && (
          <TouchableOpacity onPress={onAction} style={styles.actionButton}>
            <Text style={styles.actionText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#EEF2FF', borderRadius: 12, margin: 8 },
  message: { fontSize: 14, color: '#1E293B', marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  actionButton: { backgroundColor: '#4F46E5', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  actionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  dismissButton: { paddingHorizontal: 16, paddingVertical: 8 },
  dismissText: { color: '#64748B', fontSize: 14 },
});
