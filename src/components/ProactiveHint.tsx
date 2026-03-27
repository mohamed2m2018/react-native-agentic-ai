import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Text, Pressable } from 'react-native';

interface ProactiveHintProps {
  stage: 'hidden' | 'pulse' | 'badge';
  badgeText?: string;
  onDismiss: () => void;
  children: React.ReactNode;
}

export function ProactiveHint({ stage, badgeText = "Need help?", onDismiss, children }: ProactiveHintProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse animation logic
    if (stage === 'pulse') {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.3,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
              toValue: 0,
              duration: 1500,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.8,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      opacityAnim.stopAnimation();
      pulseAnim.setValue(1);
      opacityAnim.setValue(0);
    }

    // Badge animation logic
    if (stage === 'badge') {
      Animated.spring(badgeScale, {
        toValue: 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }).start();
    } else {
      badgeScale.setValue(0);
    }
  }, [stage, pulseAnim, opacityAnim, badgeScale]);

  return (
    <View style={styles.container}>
      {/* Badge State */}
      {stage === 'badge' && (
        <Animated.View style={[styles.badgeContainer, { transform: [{ scale: badgeScale }] }]}>
          <Text style={styles.badgeText}>{badgeText}</Text>
          <Pressable hitSlop={10} style={styles.closeButton} onPress={onDismiss}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Pulse effect under children */}
      {stage === 'pulse' && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              transform: [{ scale: pulseAnim }],
              opacity: opacityAnim,
            },
          ]}
        />
      )}

      {/* The main FAB or children */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#7B68EE',
  },
  badgeContainer: {
    position: 'absolute',
    bottom: 70, // Float above the FAB
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    minWidth: 120,
  },
  badgeText: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  closeButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
  },
  closeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'bold',
    marginTop: -2,
  },
});
