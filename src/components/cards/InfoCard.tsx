import { View, Text, StyleSheet } from 'react-native';

interface InfoCardProps {
  title?: string;
  body?: string;
  icon?: string;
}

/**
 * Built-in card template for AI injection.
 *
 * IMPORTANT: displayName must be set explicitly here.
 * In production/minified builds, the function name is mangled (e.g. `a`, `b`),
 * so `injectCardTool` cannot identify templates by inferred name alone.
 * Always look up templates by `T.displayName`, never by `T.name`.
 */
export function InfoCard({ title = 'Info', body = '', icon = 'ℹ️' }: InfoCardProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {body ? <Text style={styles.body}>{body}</Text> : null}
      </View>
    </View>
  );
}

// Must be explicit — minification mangles function.name in production builds.
InfoCard.displayName = 'InfoCard';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0f7ff',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  icon: {
    fontSize: 22,
  },
  content: {
    flex: 1,
  },
  title: {
    fontWeight: '600',
    fontSize: 14,
    color: '#1a1a2e',
    marginBottom: 2,
  },
  body: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },
});
