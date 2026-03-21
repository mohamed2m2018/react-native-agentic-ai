/**
 * Audio utility functions for PCM conversion.
 *
 * Used by AudioInputService and AudioOutputService to convert between
 * Float32 (Web Audio API) and Int16 (Gemini Live API) PCM formats.
 */

/**
 * Convert Float32Array PCM samples to Int16 PCM and encode as base64.
 * Gemini Live API expects Int16 little-endian PCM.
 */
export function float32ToInt16Base64(float32Data: Float32Array): string {
  const int16Buffer = new Int16Array(float32Data.length);
  for (let i = 0; i < float32Data.length; i++) {
    // Clamp to [-1, 1] and scale to Int16 range
    const sample = Math.max(-1, Math.min(1, float32Data[i] || 0));
    int16Buffer[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  // Convert Int16Array to base64
  const bytes = new Uint8Array(int16Buffer.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] || 0);
  }

  return typeof global.btoa === 'function'
    ? global.btoa(binary)
    : Buffer.from(binary, 'binary').toString('base64');
}

/**
 * Decode base64 Int16 PCM to Float32Array.
 * Used for manual decoding when decodePCMInBase64 is unavailable.
 */
export function base64ToFloat32(base64: string): Float32Array {
  const binaryString = typeof global.atob === 'function'
    ? global.atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');

  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const int16Data = new Int16Array(bytes.buffer);
  const float32Data = new Float32Array(int16Data.length);
  for (let i = 0; i < int16Data.length; i++) {
    // Scale Int16 back to Float32 [-1, 1]
    float32Data[i] = (int16Data[i] || 0) / 0x8000;
  }

  return float32Data;
}
