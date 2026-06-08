package com.mobileai.overlay

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * MobileAIOverlayPackage — registers the FloatingOverlayViewManager with React Native.
 *
 * Auto-linked by React Native's auto-linking system via react-native.config.js.
 * Consumers do NOT need to manually add this package to their MainApplication.
 */
class MobileAIOverlayPackage : ReactPackage {

  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return emptyList()
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return listOf(FloatingOverlayViewManager(reactContext))
  }
}
