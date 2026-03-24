/**
 * AudioOutputService — AI speech playback for voice mode.
 *
 * Uses react-native-audio-api (Software Mansion) for gapless, low-latency
 * PCM playback. Decodes base64 PCM from Gemini Live API and queues it via
 * AudioBufferQueueSourceNode for seamless streaming.
 *
 * Requires: react-native-audio-api (development build only, not Expo Go)
 */

import { logger } from '../utils/logger';
import { base64ToFloat32 } from '../utils/audioUtils';

// ─── Types ─────────────────────────────────────────────────────

/** Gemini Live API outputs 24kHz 16-bit mono PCM */
const GEMINI_OUTPUT_SAMPLE_RATE = 24000;

export interface AudioOutputConfig {
  sampleRate?: number;
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onError?: (error: string) => void;
}

// ─── Service ───────────────────────────────────────────────────

export class AudioOutputService {
  private config: AudioOutputConfig;
  private audioContext: any = null;
  private queueSourceNode: any = null;
  private gainNode: any = null;
  private muted = false;
  private isStarted = false;
  private chunkCount = 0;

  constructor(config: AudioOutputConfig = {}) {
    this.config = config;
  }

  // ─── Lifecycle ─────────────────────────────────────────────

  async initialize(): Promise<boolean> {
    try {
      let audioApi: any;
      try {
        const audioApiModule = ['react-native', 'audio-api'].join('-');
        audioApi = require(audioApiModule);
      } catch {
        const msg =
          'react-native-audio-api is required for audio output. Install with: npm install react-native-audio-api';
        logger.error('AudioOutput', msg);
        this.config.onError?.(msg);
        return false;
      }

      const sampleRate = this.config.sampleRate || GEMINI_OUTPUT_SAMPLE_RATE;

      // Configure audio session for duplex audio (simultaneous mic + speaker)
      // BEFORE creating AudioContext. This enables hardware-level AEC, AGC,
      // and noise suppression through the OS — no extra library needed.
      try {
        const { AudioManager } = audioApi;
        AudioManager.setAudioSessionOptions({
          iosCategory: 'playAndRecord',
          iosMode: 'voiceChat',
          iosOptions: ['defaultToSpeaker', 'allowBluetoothHFP'],
        });
        logger.info('AudioOutput', '🔊 Audio session configured: playAndRecord + voiceChat (hardware AEC enabled)');
      } catch (sessionErr: any) {
        logger.warn('AudioOutput', `⚠️ AudioManager setup failed: ${sessionErr?.message || sessionErr} — continuing with default session`);
      }

      // Create AudioContext at Gemini's output sample rate
      this.audioContext = new audioApi.AudioContext({ sampleRate });

      // Create GainNode for mute control
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;
      this.gainNode.connect(this.audioContext.destination);

      // Create AudioBufferQueueSourceNode for gapless streaming
      this.queueSourceNode = this.audioContext.createBufferQueueSource();
      this.queueSourceNode.connect(this.gainNode);

      logger.info('AudioOutput', `Initialized (${sampleRate}Hz, AudioBufferQueueSourceNode)`);

      // CRITICAL: Resume AudioContext — it starts in 'suspended' state.
      // Per Web Audio API spec, audio won't render until context is 'running'.
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        logger.info('AudioOutput', `AudioContext resumed: state=${this.audioContext.state}`);
      }

      return true;
    } catch (error: any) {
      logger.error('AudioOutput', `Failed to initialize: ${error.message}`);
      this.config.onError?.(error.message);
      return false;
    }
  }

  // ─── Enqueue Audio ─────────────────────────────────────────

  /** Add a base64-encoded PCM chunk from Gemini to the playback queue */
  enqueue(base64Audio: string): void {
    // LOG EVERY CALL — we need full visibility
    if (this.chunkCount < 5 || this.chunkCount % 50 === 0) {
      logger.info('AudioOutput', `📥 enqueue() called #${this.chunkCount + 1}: b64len=${base64Audio.length}, muted=${this.muted}, ctx=${!!this.audioContext}, ctxState=${this.audioContext?.state || 'null'}, queue=${!!this.queueSourceNode}, started=${this.isStarted}, gain=${this.gainNode?.gain?.value}`);
    }

    if (this.muted || !this.audioContext || !this.queueSourceNode) {
      logger.warn('AudioOutput', `⚠️ enqueue() SKIPPED #${this.chunkCount}: muted=${this.muted}, ctx=${!!this.audioContext}, queue=${!!this.queueSourceNode}`);
      return;
    }

    try {
      this.chunkCount++;

      // Decode base64 Int16 PCM → Float32
      const float32Data = base64ToFloat32(base64Audio);
      const sampleRate = this.config.sampleRate || GEMINI_OUTPUT_SAMPLE_RATE;

      // Diagnostic on first 3 chunks
      if (this.chunkCount <= 3) {
        let peakAmp = 0;
        for (let i = 0; i < float32Data.length; i++) {
          const abs = Math.abs(float32Data[i] || 0);
          if (abs > peakAmp) peakAmp = abs;
        }
        logger.info('AudioOutput', `🔍 Chunk #${this.chunkCount}: ${base64Audio.length} b64 → ${float32Data.length} samples, peakAmp=${peakAmp.toFixed(4)}, rate=${sampleRate}`);
      }

      // Create an AudioBuffer and fill it with PCM data
      const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, sampleRate);
      audioBuffer.copyToChannel(float32Data, 0);

      // Enqueue the buffer for gapless playback
      this.queueSourceNode.enqueueBuffer(audioBuffer);
      if (this.chunkCount <= 3) {
        logger.info('AudioOutput', `✅ Buffer enqueued #${this.chunkCount}`);
      }

      // Start playback on first enqueue
      if (!this.isStarted) {
        this.queueSourceNode.start();
        this.isStarted = true;
        this.config.onPlaybackStart?.();
        logger.info('AudioOutput', `▶️ Playback started — ctxState=${this.audioContext?.state}`);
      }

      if (this.chunkCount % 20 === 0) {
        logger.info('AudioOutput', `Queued chunk #${this.chunkCount}`);
      }
    } catch (error: any) {
      logger.error('AudioOutput', `❌ Enqueue error #${this.chunkCount}: ${error.message}\n${error.stack?.substring(0, 300)}`);
    }
  }

  // ─── Mute/Unmute ──────────────────────────────────────────

  mute(): void {
    this.muted = true;
    if (this.gainNode) {
      this.gainNode.gain.value = 0;
    }
    logger.info('AudioOutput', 'Speaker muted');
  }

  unmute(): void {
    this.muted = false;
    if (this.gainNode) {
      this.gainNode.gain.value = 1.0;
    }
    logger.info('AudioOutput', 'Speaker unmuted');
  }

  get isMuted(): boolean {
    return this.muted;
  }

  // ─── Stop & Cleanup ───────────────────────────────────────

  async stop(): Promise<void> {
    try {
      if (this.queueSourceNode && this.isStarted) {
        this.queueSourceNode.stop();
        this.queueSourceNode.clearBuffers();
      }
      this.isStarted = false;
      this.chunkCount = 0;

      // Web Audio API: once a source node is stopped, it CANNOT be restarted.
      // We must create a fresh AudioBufferQueueSourceNode for the next session.
      if (this.audioContext && this.gainNode) {
        this.queueSourceNode = this.audioContext.createBufferQueueSource();
        this.queueSourceNode.connect(this.gainNode);
        logger.info('AudioOutput', 'Playback stopped — fresh queue node created for next session');
      } else {
        logger.info('AudioOutput', 'Playback stopped');
      }

      this.config.onPlaybackEnd?.();
    } catch (error: any) {
      logger.error('AudioOutput', `Stop error: ${error.message}`);
    }
  }

  async cleanup(): Promise<void> {
    await this.stop();
    try {
      if (this.audioContext) {
        await this.audioContext.close();
      }
    } catch {
      // Non-critical
    }
    this.audioContext = null;
    this.queueSourceNode = null;
    this.gainNode = null;
  }
}
