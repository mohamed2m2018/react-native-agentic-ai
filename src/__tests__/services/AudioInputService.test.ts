import { AudioInputService } from '../../services/AudioInputService';

const recorderInstances: MockAudioRecorder[] = [];

class MockAudioRecorder {
  onAudioReadyCallback: ((event: any) => void) | null = null;
  onErrorCallback: ((error: any) => void) | null = null;
  start = jest.fn();
  stop = jest.fn();
  clearOnAudioReady = jest.fn(() => {
    this.onAudioReadyCallback = null;
  });
  clearOnError = jest.fn(() => {
    this.onErrorCallback = null;
  });

  constructor() {
    recorderInstances.push(this);
  }

  onAudioReady(_config: any, callback: (event: any) => void) {
    this.onAudioReadyCallback = callback;
  }

  onError(callback: (error: any) => void) {
    this.onErrorCallback = callback;
  }

  emitFrame(maxAmp: number, length = 16) {
    const data = new Float32Array(length);
    data[0] = maxAmp;
    this.onAudioReadyCallback?.({
      buffer: {
        getChannelData: () => data,
      },
    });
  }
}

jest.mock('react-native-audio-api', () => ({
  AudioRecorder: MockAudioRecorder,
}), { virtual: true });

describe('AudioInputService', () => {
  beforeEach(() => {
    recorderInstances.length = 0;
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('does not restart the recorder for valid quiet audio around 0.002 amplitude', async () => {
    const onAudioChunk = jest.fn();
    const service = new AudioInputService({ onAudioChunk });

    await expect(service.start()).resolves.toBe(true);
    const recorder = recorderInstances[0]!;

    for (let i = 0; i < 30; i++) {
      recorder.emitFrame(0.002);
    }

    expect(recorder.stop).not.toHaveBeenCalled();
    expect(recorderInstances).toHaveLength(1);
    expect(onAudioChunk).toHaveBeenCalledTimes(30);
  });

  it('restarts the recorder only after repeated near-zero dead-mic frames', async () => {
    jest.useFakeTimers();
    const onAudioChunk = jest.fn();
    const service = new AudioInputService({ onAudioChunk });

    await expect(service.start()).resolves.toBe(true);
    const recorder = recorderInstances[0]!;

    for (let i = 0; i < 14; i++) {
      recorder.emitFrame(0);
    }
    expect(recorder.stop).not.toHaveBeenCalled();

    recorder.emitFrame(0);
    expect(recorder.stop).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(300);
    expect(recorderInstances.length).toBeGreaterThanOrEqual(2);
    expect(onAudioChunk).toHaveBeenCalledTimes(14);
  });
});
