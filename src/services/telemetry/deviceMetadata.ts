import { Platform } from 'react-native';

export interface DeviceMetadata {
  platform: string;
  osVersion: string;
}

export function getDeviceMetadata(): DeviceMetadata {
  return {
    platform: Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS,
    osVersion: String(Platform.Version),
  };
}
