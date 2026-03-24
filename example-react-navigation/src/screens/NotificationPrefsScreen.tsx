import { View, Text, Switch, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useState } from 'react';

export default function NotificationPrefsScreen() {
  const [promo, setPromo] = useState(false);
  const [orderStatus, setOrderStatus] = useState(true);
  const [newDishes, setNewDishes] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [flashSales, setFlashSales] = useState(false);

  const SETTINGS = [
    { label: 'Promotional Offers', value: promo, setter: setPromo },
    { label: 'Order Status Updates', value: orderStatus, setter: setOrderStatus },
    { label: 'New Dishes Alerts', value: newDishes, setter: setNewDishes },
    { label: 'Weekly Digest', value: weeklyDigest, setter: setWeeklyDigest },
    { label: 'Flash Sale Notifications', value: flashSales, setter: setFlashSales },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Notification Preferences</Text>
      <Text style={styles.subtitle}>Choose which notifications you'd like to receive</Text>

      {SETTINGS.map(({ label, value, setter }) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Switch value={value} onValueChange={setter} />
        </View>
      ))}

      <Pressable style={styles.resetButton}>
        <Text style={styles.resetText}>Reset to Defaults</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1a2e', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6c757d', marginBottom: 24 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  label: { fontSize: 16, color: '#1a1a2e' },
  resetButton: {
    marginTop: 20,
    padding: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  resetText: { color: '#dc3545', fontSize: 15, fontWeight: '600' },
});
