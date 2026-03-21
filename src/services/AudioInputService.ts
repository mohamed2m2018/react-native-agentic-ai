/**
 * AudioInputService — Real-time microphone capture for voice mode.
 *
 * Uses react-native-audio-api (Software Mansion) AudioRecorder for native
 * PCM streaming from the microphone. Each chunk is converted from Float32
 * to Int16 PCM and base64-encoded for the Gemini Live API.
 *
 * Requires: react-native-audio-api (development build only, not Expo Go)
 */

import { logger } from '../utils/logger';
import { float32ToInt16Base64 } from '../utils/audioUtils';

// ─── Types ─────────────────────────────────────────────────────

export interface AudioInputConfig {
  sampleRate?: number;
  /** Number of samples per callback buffer (default: 4096) */
  bufferLength?: number;
  /** Callback with base64 PCM audio chunk */
  onAudioChunk: (base64Audio: string) => void;
  onError?: (error: string) => void;
  onPermissionDenied?: () => void;
}

type RecordingStatus = 'idle' | 'recording' | 'paused';

// ─── Service ───────────────────────────────────────────────────

export class AudioInputService {
  private config: AudioInputConfig;
  private status: RecordingStatus = 'idle';
  private recorder: any = null;

  constructor(config: AudioInputConfig) {
    this.config = config;
  }

  // ─── Lifecycle ─────────────────────────────────────────────

  async start(): Promise<boolean> {
    try {
      // Lazy-load react-native-audio-api (optional peer dependency)
      let audioApi: any;
      try {
        audioApi = require('react-native-audio-api');
      } catch {
        const msg =
          'Voice mode requires react-native-audio-api. Install with: npm install react-native-audio-api';
        logger.error('AudioInput', msg);
        this.config.onError?.(msg);
        return false;
      }

      // Request mic permission (Android)
      try {
        const { PermissionsAndroid, Platform } = require('react-native');
        if (Platform.OS === 'android') {
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
          );
          if (result !== PermissionsAndroid.RESULTS.GRANTED) {
            logger.warn('AudioInput', 'Microphone permission denied');
            this.config.onPermissionDenied?.();
            return false;
          }
        }
      } catch {
        // Permission check failed — continue and let native layer handle it
      }

      // Create AudioRecorder
      this.recorder = new audioApi.AudioRecorder();

      const sampleRate = this.config.sampleRate || 16000;
      const bufferLength = this.config.bufferLength || 4096;

      // Register audio data callback
      let frameCount = 0;
      this.recorder.onAudioReady(
        { sampleRate, bufferLength, channelCount: 1 },
        (event: any) => {
          frameCount++;
          try {
            // event.buffer is an AudioBuffer — get Float32 channel data
            const float32Data = event.buffer.getChannelData(0);
            // Convert Float32 → Int16 → base64 for Gemini
            const base64Chunk = float32ToInt16Base64(float32Data);
            logger.debug('AudioInput', `🎤 Frame #${frameCount}: size=${base64Chunk.length}`);
            this.config.onAudioChunk(base64Chunk);
          } catch (err: any) {
            logger.error('AudioInput', `Frame processing error: ${err.message}`);
          }
        }
      );

      // Register error callback
      this.recorder.onError((error: any) => {
        logger.error('AudioInput', `Recorder error: ${error.message || error}`);
        this.config.onError?.(error.message || String(error));
      });

      // Start recording
      this.recorder.start();
      this.status = 'recording';
      logger.info('AudioInput', `Streaming started (${sampleRate}Hz, bufLen=${bufferLength})`);
      return true;
    } catch (error: any) {
      logger.error('AudioInput', `Failed to start: ${error.message}`);
      this.config.onError?.(error.message);
      return false;
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.recorder && this.status !== 'idle') {
        this.recorder.clearOnAudioReady();
        this.recorder.clearOnError();
        this.recorder.stop();
      }
      this.recorder = null;
      this.status = 'idle';
      logger.info('AudioInput', 'Streaming stopped');
    } catch (error: any) {
      logger.error('AudioInput', `Failed to stop: ${error.message}`);
      this.recorder = null;
      this.status = 'idle';
    }
  }

  // ─── Status ───────────────────────────────────────────────

  get isRecording(): boolean {
    return this.status === 'recording';
  }

  get currentStatus(): RecordingStatus {
    return this.status;
  }
}
