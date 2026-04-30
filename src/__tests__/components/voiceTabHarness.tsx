import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export const mockTelemetryTrack = jest.fn();
export const mockTelemetrySetAgentActing = jest.fn();
export const mockTelemetrySetScreen = jest.fn();

jest.mock('../../services/telemetry', () => ({
  TelemetryService: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    track: mockTelemetryTrack,
    setScreen: mockTelemetrySetScreen,
    setAgentActing: mockTelemetrySetAgentActing,
    getScreenFlow: jest.fn(() => []),
  })),
  bindTelemetryService: jest.fn(),
}));

jest.mock('../../core/FiberTreeWalker', () => ({
  walkFiberTree: jest.fn(() => ({
    elementsText: '[0]<pressable>Profile />\n[1]<text-input>Name />\n',
    interactives: [
      {
        index: 0,
        type: 'pressable',
        label: 'Profile',
        fiberNode: {},
        props: { onPress: jest.fn() },
      },
      {
        index: 1,
        type: 'text-input',
        label: 'Name',
        fiberNode: {},
        props: { onChangeText: jest.fn() },
      },
    ],
  })),
  findScrollableContainers: jest.fn(() => []),
  captureWireframe: jest.fn(() => null),
}));

jest.mock('../../core/ScreenDehydrator', () => ({
  dehydrateScreen: jest.fn((_screenName, availableScreens, elementsText, elements) => ({
    screenName: 'Home',
    availableScreens: availableScreens || ['Home', 'Profile', 'Settings'],
    elementsText: `Screen: Home\n${elementsText || ''}`,
    elements: elements || [],
  })),
}));

export const voiceInstances: any[] = [];
export const audioInputInstances: any[] = [];
export const audioOutputInstances: any[] = [];

let audioInputStartResult = true;
let audioInputStartDeferred: Deferred<boolean> | null = null;
let audioInputStopDeferred: Deferred<void> | null = null;
let audioOutputInitializeDeferred: Deferred<boolean> | null = null;

export function setAudioInputStartResult(value: boolean) {
  audioInputStartResult = value;
}

export function deferAudioInputStart() {
  audioInputStartDeferred = createDeferred<boolean>();
  return audioInputStartDeferred;
}

export function deferAudioInputStop() {
  audioInputStopDeferred = createDeferred<void>();
  return audioInputStopDeferred;
}

export function deferAudioOutputInitialize() {
  audioOutputInitializeDeferred = createDeferred<boolean>();
  return audioOutputInitializeDeferred;
}

export function MockVoiceService(this: any, config: any) {
  this.config = config;
  this.lastCallbacks = null;
  this.intentionalDisconnect = false;
  this.connected = false;
  this.connect = jest.fn(async (callbacks: any) => {
    this.lastCallbacks = callbacks;
    return undefined;
  });
  this.disconnect = jest.fn(() => {
    this.intentionalDisconnect = true;
    this.connected = false;
  });
  this.sendAudio = jest.fn();
  this.sendScreenContext = jest.fn();
  this.sendFunctionResponse = jest.fn();
  Object.defineProperty(this, 'isConnected', {
    get: () => this.connected,
  });
  voiceInstances.push(this);
}

export function MockAudioInputService(this: any, config: any) {
  this.config = config;
  this.start = jest.fn(async () => {
    if (audioInputStartDeferred) return audioInputStartDeferred.promise;
    return audioInputStartResult;
  });
  this.stop = jest.fn(async () => {
    if (audioInputStopDeferred) return audioInputStopDeferred.promise;
    return undefined;
  });
  audioInputInstances.push(this);
}

export function MockAudioOutputService(this: any, config: any = {}) {
  this.config = config;
  this.initialize = jest.fn(async () => {
    if (audioOutputInitializeDeferred) return audioOutputInitializeDeferred.promise;
    return true;
  });
  this.enqueue = jest.fn();
  this.stop = jest.fn(async () => undefined);
  this.cleanup = jest.fn(async () => undefined);
  this.mute = jest.fn();
  this.unmute = jest.fn();
  audioOutputInstances.push(this);
}

jest.mock('../../services/VoiceService', () => ({
  VoiceService: MockVoiceService,
}));

jest.mock('../../services/AudioInputService', () => ({
  AudioInputService: MockAudioInputService,
}));

jest.mock('../../services/AudioOutputService', () => ({
  AudioOutputService: MockAudioOutputService,
}));

import { AIAgent } from '../../components/AIAgent';

export function resetVoiceHarness() {
  voiceInstances.length = 0;
  audioInputInstances.length = 0;
  audioOutputInstances.length = 0;
  audioInputStartResult = true;
  audioInputStartDeferred = null;
  audioInputStopDeferred = null;
  audioOutputInitializeDeferred = null;
  mockTelemetryTrack.mockClear();
  mockTelemetrySetAgentActing.mockClear();
  mockTelemetrySetScreen.mockClear();
  jest.clearAllMocks();
}

export async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

export function renderVoiceAgent(
  props: Partial<React.ComponentProps<typeof AIAgent>> = {}
) {
  return render(
    <AIAgent
      apiKey="test-key"
      enableVoice
      consent={{ required: false }}
      debug={false}
      {...props}
    >
      <Text testID="app-content">Home Screen</Text>
    </AIAgent>
  );
}

export async function expandChat(utils: ReturnType<typeof renderVoiceAgent>) {
  fireEvent.press(utils.getByLabelText('Open AI Agent Chat'));
  await flushPromises();
}

export async function switchToVoice(utils: ReturnType<typeof renderVoiceAgent>) {
  await expandChat(utils);
  fireEvent.press(utils.getByLabelText('Switch to Voice mode'));
  await flushPromises();
}

export async function switchToText(utils: ReturnType<typeof renderVoiceAgent>) {
  fireEvent.press(utils.getByLabelText('Switch to Text mode'));
  await flushPromises();
}

export async function emitConnected() {
  const voice = voiceInstances[voiceInstances.length - 1]!;
  await act(async () => {
    voice.connected = true;
    voice.lastCallbacks?.onStatusChange?.('connected');
    await Promise.resolve();
  });
  await flushPromises();
}

export async function emitDisconnected(intentional = false) {
  const voice = voiceInstances[voiceInstances.length - 1]!;
  await act(async () => {
    voice.intentionalDisconnect = intentional;
    voice.connected = false;
    voice.lastCallbacks?.onStatusChange?.('disconnected');
    await Promise.resolve();
  });
  await flushPromises();
}

export async function emitSetupComplete() {
  const voice = voiceInstances[voiceInstances.length - 1]!;
  await act(async () => {
    voice.lastCallbacks?.onSetupComplete?.();
    await Promise.resolve();
  });
  await flushPromises();
}

export async function emitToolCall(name: string, args: Record<string, any>, id = 'call-1') {
  const voice = voiceInstances[voiceInstances.length - 1]!;
  await act(async () => {
    await voice.lastCallbacks?.onToolCall?.({ name, args, id });
  });
  await flushPromises();
}

export async function emitAudioResponse(audio = 'base64-audio') {
  const voice = voiceInstances[voiceInstances.length - 1]!;
  await act(async () => {
    voice.lastCallbacks?.onAudioResponse?.(audio);
  });
  await flushPromises();
}

export async function emitTurnComplete() {
  const voice = voiceInstances[voiceInstances.length - 1]!;
  await act(async () => {
    voice.lastCallbacks?.onTurnComplete?.();
  });
  await flushPromises();
}

export async function emitVoiceError(message = 'voice failed') {
  const voice = voiceInstances[voiceInstances.length - 1]!;
  await act(async () => {
    voice.lastCallbacks?.onError?.(message);
  });
  await flushPromises();
}

export async function waitForVoiceService() {
  await waitFor(() => expect(voiceInstances.length).toBeGreaterThan(0));
  return voiceInstances[voiceInstances.length - 1]!;
}

export async function waitForAudioInput() {
  await waitFor(() => expect(audioInputInstances.length).toBeGreaterThan(0));
  return audioInputInstances[audioInputInstances.length - 1]!;
}

export async function waitForAudioOutput() {
  await waitFor(() => expect(audioOutputInstances.length).toBeGreaterThan(0));
  return audioOutputInstances[audioOutputInstances.length - 1]!;
}
