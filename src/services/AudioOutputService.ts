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
        audioApi = require('react-native-audio-api');
      } catch {
        const msg =
          'react-native-audio-api is required for audio output. Install with: npm install react-native-audio-api';
        logger.error('AudioOutput', msg);
        this.config.onError?.(msg);
        return false;
      }

      const sampleRate = this.config.sampleRate || GEMINI_OUTPUT_SAMPLE_RATE;

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
    if (this.muted || !this.audioContext || !this.queueSourceNode) return;

    try {
      this.chunkCount++;

      // Decode base64 Int16 PCM → Float32
      const float32Data = base64ToFloat32(base64Audio);
      const sampleRate = this.config.sampleRate || GEMINI_OUTPUT_SAMPLE_RATE;

      // Create an AudioBuffer and fill it with PCM data
      const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, sampleRate);
      audioBuffer.copyToChannel(float32Data, 0);

      // Enqueue the buffer for gapless playback
      this.queueSourceNode.enqueueBuffer(audioBuffer);

      // Start playback on first enqueue
      if (!this.isStarted) {
        this.queueSourceNode.start();
        this.isStarted = true;
        this.config.onPlaybackStart?.();
        logger.info('AudioOutput', '▶️ Playback started');
      }

      if (this.chunkCount % 20 === 0) {
        logger.debug('AudioOutput', `Queued chunk #${this.chunkCount}`);
      }
    } catch (error: any) {
      logger.error('AudioOutput', `Enqueue error: ${error.message}`);
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
      this.config.onPlaybackEnd?.();
      logger.info('AudioOutput', 'Playback stopped');
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
