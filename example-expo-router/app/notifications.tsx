import { StyleSheet, Switch } from 'react-native';
import { useState } from 'react';
import { Text, View } from '@/components/Themed';

export default function NotificationsScreen() {
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);
  const [sms, setSms] = useState(false);
  const [deals, setDeals] = useState(true);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifications</Text>

      <View style={styles.row}>
        <Text style={styles.rowText}>Push Notifications</Text>
        <Switch value={push} onValueChange={setPush} />
      </View>
      <View style={styles.row}>
        <Text style={styles.rowText}>Email Notifications</Text>
        <Switch value={email} onValueChange={setEmail} />
      </View>
      <View style={styles.row}>
        <Text style={styles.rowText}>SMS Notifications</Text>
        <Switch value={sms} onValueChange={setSms} />
      </View>
      <View style={styles.row}>
        <Text style={styles.rowText}>Deal Alerts</Text>
        <Switch value={deals} onValueChange={setDeals} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(150,150,150,0.3)',
  },
  rowText: { fontSize: 16 },
});
