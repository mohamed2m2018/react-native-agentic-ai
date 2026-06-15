import { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, DeviceEventEmitter, Dimensions } from 'react-native';

export type HighlightAction = 'tap' | 'read' | 'type' | 'verify' | 'scroll' | 'fill' | 'wait';

export interface HighlightEventData {
  pageX: number;
  pageY: number;
  width: number;
  height: number;
  message: string;
  action?: HighlightAction;
  autoRemoveAfterMs?: number;
}

const ACTION_GLYPH: Record<HighlightAction, string> = {
  tap: '›',
  read: '◉',
  type: '⌨',
  verify: '✓',
  scroll: '↕',
  fill: '✎',
  wait: '⏱',
};

const ACTION_FALLBACK_LABEL: Record<HighlightAction, string> = {
  tap: 'Tap',
  read: 'Reading',
  type: 'Typing',
  verify: 'Verifying',
  scroll: 'Scrolling',
  fill: 'Filling',
  wait: 'Working',
};

export function HighlightOverlay() {
  const [highlight, setHighlight] = useState<HighlightEventData | null>(null);
  const [tooltipWidth, setTooltipWidth] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const tipSlideAnim = useRef(new Animated.Value(8)).current;
  const tipFadeAnim = useRef(new Animated.Value(0)).current;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const dismiss = useCallback(() => {
    pulseRef.current?.stop();
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setHighlight(null);
    });
  }, [fadeAnim]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('MOBILE_AI_HIGHLIGHT', (data: HighlightEventData | null) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      pulseRef.current?.stop();

      if (!data) {
        dismiss();
        return;
      }

      setHighlight(data);

      fadeAnim.setValue(0);
      pulseAnim.setValue(1);
      tipSlideAnim.setValue(8);
      tipFadeAnim.setValue(0);

      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start(() => {
        const pulse = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.18, duration: 800, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          ])
        );
        pulseRef.current = pulse;
        pulse.start();
      });

      Animated.parallel([
        Animated.timing(tipFadeAnim, { toValue: 1, duration: 250, delay: 120, useNativeDriver: true }),
        Animated.timing(tipSlideAnim, { toValue: 0, duration: 300, delay: 120, useNativeDriver: true }),
      ]).start();

      const ms = data.autoRemoveAfterMs || 5000;
      timerRef.current = setTimeout(dismiss, ms);
    });

    return () => sub.remove();
  }, [fadeAnim, pulseAnim, tipSlideAnim, tipFadeAnim, dismiss]);

  if (!highlight) return null;

  const { pageX, pageY, width, height, message, action } = highlight;
  const screenW = Dimensions.get('window').width;

  const ringLeft = pageX - 4;
  const ringTop = pageY - 4;
  const ringW = width + 8;
  const ringH = height + 8;

  const isTooHigh = pageY < 80;
  const tipH = 38;
  const tipGap = 10;
  const tooltipTop = isTooHigh ? ringTop + ringH + tipGap : ringTop - tipH - tipGap;

  let tooltipLeft = ringLeft + ringW / 2 - tooltipWidth / 2;
  tooltipLeft = Math.max(10, Math.min(tooltipLeft, screenW - tooltipWidth - 10));

  const label = message || (action ? ACTION_FALLBACK_LABEL[action] : '');
  const glyph = action ? ACTION_GLYPH[action] : null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]} pointerEvents="box-none">
      <Pressable testID="highlight-close-zone" style={StyleSheet.absoluteFill} onPress={dismiss} />

      <Animated.View
        style={[
          styles.ring,
          {
            left: ringLeft,
            top: ringTop,
            width: ringW,
            height: ringH,
            opacity: fadeAnim,
            transform: [{ scale: pulseAnim }],
          }
        ]}
        pointerEvents="none"
      />

      <Animated.View
        onLayout={(e) => setTooltipWidth(e.nativeEvent.layout.width)}
        style={[
          styles.tooltip,
          {
            top: tooltipTop,
            left: tooltipWidth > 0 ? tooltipLeft : undefined,
            alignSelf: tooltipWidth > 0 ? undefined : 'center',
            opacity: tipFadeAnim,
            transform: [{ translateY: isTooHigh ? tipSlideAnim : Animated.multiply(tipSlideAnim, -1) }],
          }
        ]}
        pointerEvents="none"
      >
        {glyph ? (
          <View style={styles.glyphPill}>
            <Text style={styles.glyphText}>{glyph}</Text>
          </View>
        ) : null}
        {label ? <Text style={styles.message}>{label}</Text> : null}
        <View style={[isTooHigh ? styles.arrowUp : styles.arrowDown]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 99999,
    elevation: 99999,
  },
  ring: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#007AFF',
    borderRadius: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.15)',
    zIndex: 99999,
    elevation: 99999,
  },
  tooltip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 100000,
    zIndex: 100000,
  },
  glyphPill: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  message: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  arrowDown: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#007AFF',
  },
  arrowUp: {
    position: 'absolute',
    top: -6,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#007AFF',
  }
});
