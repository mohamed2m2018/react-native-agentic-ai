import { StyleSheet, Pressable } from 'react-native';
import { useState } from 'react';
import { Text, View } from '@/components/Themed';

const LANGUAGES = ['English', 'Arabic', 'Spanish', 'French', 'German', 'Japanese'];

export default function LanguageScreen() {
  const [selected, setSelected] = useState('English');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Language</Text>
      <Text style={styles.subtitle}>Select your preferred language</Text>

      {LANGUAGES.map((lang) => (
        <Pressable key={lang} style={styles.row} onPress={() => setSelected(lang)}>
          <Text style={styles.rowText}>{lang}</Text>
          {selected === lang && <Text style={styles.check}>✓</Text>}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6c757d', marginBottom: 24 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(150,150,150,0.3)',
  },
  rowText: { fontSize: 16 },
  check: { fontSize: 18, color: '#3498DB', fontWeight: '700' },
});
