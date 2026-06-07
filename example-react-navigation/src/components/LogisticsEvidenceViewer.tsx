import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import type { LogisticsDisputeRecord } from '../supportData';

export function LogisticsEvidenceViewer({ record }: { record: LogisticsDisputeRecord }) {
  const isMatch = record.gpsMatchStatus === 'match';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Delivery Forensics</Text>
      
      <View style={styles.forensicsRow}>
        <View style={styles.forensicsBox}>
          <Text style={styles.boxLabel}>Courier GPS Info</Text>
          <Text style={[styles.statusText, isMatch ? styles.match : styles.mismatch]}>
            GEO-FENCE: {isMatch ? 'ALIGNED' : 'MISMATCH'}
          </Text>
        </View>
        <View style={styles.forensicsBox}>
          <Text style={styles.boxLabel}>Proof of Delivery</Text>
          <View style={styles.mockPhoto}>
            <Text style={styles.mockPhotoText}>IMG_1029.jpg</Text>
          </View>
        </View>
      </View>

      <View style={styles.timeline}>
        <Text style={styles.timelineTitle}>Action Log</Text>
        {record.driverLogs.map((log, index) => (
          <View key={index} style={styles.logRow}>
            <View style={styles.logDot} />
            <Text style={styles.logTime}>{log.time}</Text>
            <Text style={styles.logAction}>{log.action}</Text>
          </View>
        ))}
        <View style={styles.timelineLine} />
      </View>
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16,
  },
  forensicsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  forensicsBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  boxLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  match: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  mismatch: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  mockPhoto: {
    width: 60,
    height: 40,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockPhotoText: {
    fontSize: 8,
    color: '#94a3b8',
  },
  timeline: {
    position: 'relative',
    paddingLeft: 10,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 12,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    position: 'relative',
    zIndex: 2,
  },
  logDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
    marginTop: 4,
    marginRight: 12,
  },
  logTime: {
    fontSize: 13,
    color: '#64748b',
    width: 65,
  },
  logAction: {
    fontSize: 13,
    color: '#0f172a',
    flex: 1,
  },
  timelineLine: {
    position: 'absolute',
    top: 30,
    bottom: 10,
    left: 13,
    width: 2,
    backgroundColor: '#e2e8f0',
    zIndex: 1,
  },
});
