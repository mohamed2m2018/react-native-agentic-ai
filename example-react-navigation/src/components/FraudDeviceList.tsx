import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import type { DeviceSession } from '../supportData';

type Props = {
  devices: DeviceSession[];
  onToggleDevice: (deviceId: string, revoke: boolean) => void;
};

export function FraudDeviceList({ devices, onToggleDevice }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recognize these devices?</Text>
      <Text style={styles.subtitle}>Toggle off any device you don't recognize to instantly revoke its access to your account.</Text>
      
      {devices.map((device) => (
        <View key={device.id} style={styles.deviceRow}>
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceName}>
              {device.deviceName} {device.isCurrentDevice && '(This Device)'}
            </Text>
            <Text style={styles.deviceMeta}>{device.location} · {device.lastActive}</Text>
          </View>
          <Switch
            value={device.status === 'active'}
            onValueChange={(val) => onToggleDevice(device.id, !val)}
            disabled={device.isCurrentDevice}
            trackColor={{ false: '#ff4d4d', true: '#4cd964' }}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  deviceInfo: {
    flex: 1,
    paddingRight: 10,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  deviceMeta: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
});
