import { StyleSheet, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';

export function AboutScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>About ShopApp</Text>
      <Text style={styles.version}>Version 1.0.0</Text>
      <Text style={styles.description}>
        ShopApp is a demo application showcasing the integration of AI agents with Expo Router.
        This app demonstrates how an AI assistant can navigate between screens, fill forms,
        tap buttons, and interact with your React Native app&apos;s live UI.
      </Text>
      <Text style={styles.description}>
        Built with @mobileai/react-native — the drop-in AI agent for React Native apps.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Technologies</Text>
        <Text style={styles.item}>Expo Router (File-based routing)</Text>
        <Text style={styles.item}>React Native</Text>
        <Text style={styles.item}>@mobileai/react-native (AI Agent)</Text>
        <Text style={styles.item}>Google Gemini API</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold' },
  version: { fontSize: 14, color: '#6c757d', marginTop: 4 },
  description: { fontSize: 15, lineHeight: 22, color: '#555', marginTop: 16 },
  section: { marginTop: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  item: { fontSize: 15, color: '#555', paddingVertical: 6 },
});
