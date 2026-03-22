import { StyleSheet, Pressable } from 'react-native';
import { useState } from 'react';
import { Text, View } from '@/components/Themed';

const THEMES = ['System', 'Light', 'Dark'];

export default function AppearanceScreen() {
  const [selected, setSelected] = useState('System');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Appearance</Text>
      <Text style={styles.subtitle}>Choose your preferred theme</Text>

      {THEMES.map((theme) => (
        <Pressable key={theme} style={styles.row} onPress={() => setSelected(theme)}>
          <Text style={styles.rowText}>{theme}</Text>
          <View style={[styles.radio, selected === theme && styles.radioSelected]}>
            {selected === theme && <View style={styles.radioDot} />}
          </View>
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
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
  radioSelected: { borderColor: '#3498DB' },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#3498DB' },
});
