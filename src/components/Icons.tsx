/**
 * Icons — Zero-dependency, View-based icons for the AI Agent chat bar.
 *
 * Why not emoji? iOS Simulator 26+ has a bug where emoji renders as "?".
 * Why not Unicode symbols? They look obscure and unprofessional.
 * Why not icon libraries? This is a library — zero runtime dependencies.
 *
 * These icons are built purely from React Native View components,
 * rendering identically on every platform and screen size.
 */

import { View } from 'react-native';

// ─── Mic Icon (pill + stem + base) ────────────────────────────

export function MicIcon({ size = 20, color = '#fff' }: { size?: number; color?: string }) {
  const pillW = size * 0.4;
  const pillH = size * 0.5;
  const stemW = size * 0.08;
  const stemH = size * 0.18;
  const baseW = size * 0.35;
  const arcW = size * 0.55;
  const arcH = size * 0.35;
  const arcBorder = size * 0.07;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Pill (mic head) */}
      <View style={{
        width: pillW,
        height: pillH,
        borderRadius: pillW / 2,
        backgroundColor: color,
      }} />
      {/* Arc (U-shape around mic) */}
      <View style={{
        width: arcW,
        height: arcH,
        borderBottomLeftRadius: arcW / 2,
        borderBottomRightRadius: arcW / 2,
        borderWidth: arcBorder,
        borderTopWidth: 0,
        borderColor: color,
        marginTop: -(pillH * 0.3),
      }} />
      {/* Stem */}
      <View style={{
        width: stemW,
        height: stemH,
        backgroundColor: color,
        marginTop: -1,
      }} />
      {/* Base */}
      <View style={{
        width: baseW,
        height: stemW,
        backgroundColor: color,
        borderRadius: stemW / 2,
      }} />
    </View>
  );
}

// ─── Speaker Icon (cone + sound waves) ────────────────────────

export function SpeakerIcon({ size = 20, color = '#fff', muted = false }: { size?: number; color?: string; muted?: boolean }) {
  const bodyW = size * 0.25;
  const bodyH = size * 0.3;
  const coneW = size * 0.2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
      {/* Speaker body (rectangle) */}
      <View style={{
        width: bodyW,
        height: bodyH,
        backgroundColor: color,
        borderRadius: size * 0.03,
      }} />
      {/* Speaker cone (triangle via borders) */}
      <View style={{
        width: 0,
        height: 0,
        borderTopWidth: size * 0.25,
        borderTopColor: 'transparent',
        borderBottomWidth: size * 0.25,
        borderBottomColor: 'transparent',
        borderLeftWidth: coneW,
        borderLeftColor: color,
        marginLeft: -1,
      }} />
      {muted ? (
        /* Mute slash */
        <View style={{
          position: 'absolute',
          width: size * 0.08,
          height: size * 0.8,
          backgroundColor: color,
          borderRadius: size * 0.04,
          transform: [{ rotate: '45deg' }],
        }} />
      ) : (
        /* Sound waves */
        <View style={{ marginLeft: size * 0.05 }}>
          <View style={{
            width: size * 0.15,
            height: size * 0.3,
            borderWidth: size * 0.05,
            borderColor: color,
            borderLeftWidth: 0,
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
            borderTopRightRadius: size * 0.15,
            borderBottomRightRadius: size * 0.15,
          }} />
        </View>
      )}
    </View>
  );
}

// ─── Send Arrow (upward arrow) ────────────────────────────────

export function SendArrowIcon({ size = 18, color = '#fff' }: { size?: number; color?: string }) {
  // Filled right-pointing triangle (like iOS Messages send button)
  const triH = size * 0.55;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: 0,
        height: 0,
        borderTopWidth: triH / 2,
        borderTopColor: 'transparent',
        borderBottomWidth: triH / 2,
        borderBottomColor: 'transparent',
        borderLeftWidth: triH * 0.85,
        borderLeftColor: color,
        marginLeft: size * 0.1,
      }} />
    </View>
  );
}

// ─── Stop Icon (filled square) ────────────────────────────────

export function StopIcon({ size = 18, color = '#fff' }: { size?: number; color?: string }) {
  const sq = size * 0.45;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: sq,
        height: sq,
        backgroundColor: color,
        borderRadius: size * 0.05,
      }} />
    </View>
  );
}

// ─── Recording Dot (pulsing filled circle) ────────────────────

export function RecordingDot({ size = 18, color = '#FF3B30' }: { size?: number; color?: string }) {
  const dotSize = size * 0.45;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: dotSize,
        height: dotSize,
        borderRadius: dotSize / 2,
        backgroundColor: color,
      }} />
    </View>
  );
}

// ─── Loading Spinner (three dots) ─────────────────────────────

export function LoadingDots({ size = 18, color = '#fff' }: { size?: number; color?: string }) {
  const dotSize = size * 0.15;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: dotSize * 0.8 }}>
      {[0.4, 0.7, 1].map((opacity, i) => (
        <View key={i} style={{
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: color,
          opacity,
        }} />
      ))}
    </View>
  );
}

// ─── Close / Dismiss (X mark) ─────────────────────────────────

export function CloseIcon({ size = 14, color = 'rgba(255,255,255,0.6)' }: { size?: number; color?: string }) {
  const barW = size * 0.7;
  const barH = size * 0.12;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        position: 'absolute',
        width: barW,
        height: barH,
        backgroundColor: color,
        borderRadius: barH,
        transform: [{ rotate: '45deg' }],
      }} />
      <View style={{
        position: 'absolute',
        width: barW,
        height: barH,
        backgroundColor: color,
        borderRadius: barH,
        transform: [{ rotate: '-45deg' }],
      }} />
    </View>
  );
}

// ─── AI Badge (for FAB) ───────────────────────────────────────

export function AIBadge({ size = 28 }: { size?: number }) {
  // Chat bubble — clean, universally represents AI assistant
  const bubbleW = size * 0.6;
  const bubbleH = size * 0.45;
  const tailSize = size * 0.12;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Bubble body */}
      <View style={{
        width: bubbleW,
        height: bubbleH,
        backgroundColor: '#fff',
        borderRadius: size * 0.12,
        marginBottom: tailSize * 0.5,
      }} />
      {/* Tail (small triangle at bottom-left) */}
      <View style={{
        position: 'absolute',
        bottom: size * 0.18,
        left: size * 0.22,
        width: 0,
        height: 0,
        borderTopWidth: tailSize,
        borderTopColor: '#fff',
        borderRightWidth: tailSize,
        borderRightColor: 'transparent',
      }} />
    </View>
  );
}
// ─── History Icon (clock face: circle + hour + minute hands) ──

export function HistoryIcon({ size = 18, color = '#fff' }: { size?: number; color?: string }) {
  const half = size / 2;
  const stroke = Math.max(1.5, size * 0.09);
  const ringSize = size * 0.9;
  const minuteLen = half * 0.72; // from center to 12 o'clock
  const hourLen = half * 0.52;   // from center to 3 o'clock

  return (
    <View style={{ width: size, height: size }}>
      {/* Outer ring */}
      <View style={{
        position: 'absolute',
        width: ringSize,
        height: ringSize,
        borderRadius: ringSize / 2,
        borderWidth: stroke,
        borderColor: color,
        top: (size - ringSize) / 2,
        left: (size - ringSize) / 2,
      }} />
      {/* Minute hand — straight up from center to 12 */}
      <View style={{
        position: 'absolute',
        width: stroke,
        height: minuteLen,
        backgroundColor: color,
        borderRadius: stroke,
        top: half - minuteLen,
        left: half - stroke / 2,
      }} />
      {/* Hour hand — straight right from center to 3 */}
      <View style={{
        position: 'absolute',
        width: hourLen,
        height: stroke,
        backgroundColor: color,
        borderRadius: stroke,
        top: half - stroke / 2,
        left: half,
      }} />
      {/* Center dot */}
      <View style={{
        position: 'absolute',
        width: stroke * 2,
        height: stroke * 2,
        borderRadius: stroke,
        backgroundColor: color,
        top: half - stroke,
        left: half - stroke,
      }} />
    </View>
  );
}


// ─── New Chat Icon (chat bubble + plus) ───────────────────────

export function NewChatIcon({ size = 18, color = '#fff' }: { size?: number; color?: string }) {
  const stroke = size * 0.1;
  const armLen = size * 0.35;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Bubble body */}
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: size * 0.72,
        height: size * 0.62,
        borderRadius: size * 0.15,
        borderWidth: stroke,
        borderColor: color,
      }} />
      {/* Bubble tail */}
      <View style={{
        position: 'absolute',
        bottom: size * 0.22,
        left: size * 0.1,
        width: 0,
        height: 0,
        borderTopWidth: size * 0.14,
        borderTopColor: color,
        borderRightWidth: size * 0.1,
        borderRightColor: 'transparent',
      }} />
      {/* Plus — horizontal bar */}
      <View style={{
        position: 'absolute',
        top: size * 0.09,
        right: 0,
        width: armLen,
        height: stroke,
        backgroundColor: color,
        borderRadius: stroke,
      }} />
      {/* Plus — vertical bar */}
      <View style={{
        position: 'absolute',
        top: size * 0.09 - armLen / 2 + stroke / 2,
        right: armLen / 2 - stroke / 2,
        width: stroke,
        height: armLen,
        backgroundColor: color,
        borderRadius: stroke,
      }} />
    </View>
  );
}
