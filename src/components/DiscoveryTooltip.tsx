/**
 * DiscoveryTooltip — One-time tooltip shown above the FAB on first use.
 *
 * Tells users the AI can navigate the app and do things for them.
 * Shows once, then persists dismissal via AsyncStorage.
 * Bilingual: EN/AR.
 */

import { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';

interface DiscoveryTooltipProps {
  language: 'en' | 'ar';
  primaryColor?: string;
  onDismiss: () => void;
  side?: 'left' | 'right';
  message?: string;
}

const LABELS = {
  en: 'Ask me to find items, answer questions, or complete tasks for you.',
  ar: 'اطلب مني ألاقي العناصر، أجاوب على الأسئلة، أو أكمل المهام عنك.',
};

const AUTO_DISMISS_MS = 6000;

export function DiscoveryTooltip({
  language,
  primaryColor,
  onDismiss,
  side = 'left',
  message,
}: DiscoveryTooltipProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Spring-in entry
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss after timeout
    const timer = setTimeout(() => {
      dismissWithAnimation();
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissWithAnimation = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  };

  const isArabic = language === 'ar';
  const bgColor = primaryColor || '#1a1a2e';

  return (
    <Animated.View
      style={[
        styles.container,
        side === 'right' ? styles.containerRight : styles.containerLeft,
        {
          backgroundColor: bgColor,
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <Pressable onPress={dismissWithAnimation} style={styles.contentArea}>
        <Text style={[styles.text, isArabic && styles.textRTL]}>
          {message || LABELS[language]}
        </Text>
      </Pressable>

      {/* Triangle pointer toward FAB */}
      <View
        style={[
          styles.pointer,
          side === 'right' ? styles.pointerRight : styles.pointerLeft,
          { borderTopColor: bgColor },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 70,
    width: 220,
    maxWidth: 260,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  containerLeft: {
    right: -4,
  },
  containerRight: {
    left: -4,
  },
  contentArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  pointer: {
    position: 'absolute',
    bottom: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#1a1a2e',
  },
  pointerLeft: {
    right: 22,
  },
  pointerRight: {
    left: 22,
  },
});
