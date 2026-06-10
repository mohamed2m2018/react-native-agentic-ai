/**
 * Codegen spec for MobileAIFloatingOverlay native view.
 *
 * This file is required by React Native's Codegen (New Architecture / Fabric).
 * It defines the TypeScript interface for the native view. During the build,
 * Codegen uses this spec to generate C++ glue code that bridges JS and native.
 *
 * Consumers don't use this directly — use FloatingOverlayWrapper.tsx instead.
 *
 * Naming convention: file must end in NativeComponent.ts (Codegen convention).
 */

import type { ViewProps } from 'react-native';
import type { Int32 } from 'react-native/Libraries/Types/CodegenTypes';
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';

export interface NativeProps extends ViewProps {
  windowX?: Int32;
  windowY?: Int32;
  windowWidth?: Int32;
  windowHeight?: Int32;
}

// Codegen reads this export to generate the native component interfaces.
export default codegenNativeComponent<NativeProps>('MobileAIFloatingOverlay');
