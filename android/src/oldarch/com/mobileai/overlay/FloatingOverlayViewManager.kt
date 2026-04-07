package com.mobileai.overlay

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

/**
 * Old Architecture (Paper) ViewManager for MobileAIFloatingOverlay.
 *
 * Used when newArchEnabled=false in the consuming app's gradle.properties.
 * Loaded via the oldarch/ sourceSet in build.gradle.
 *
 * Consumers don't interact with this class — it's registered automatically via
 * MobileAIOverlayPackage and the React Native auto-linking system.
 */
class FloatingOverlayViewManager(
  private val reactApplicationContext: ReactApplicationContext
) : SimpleViewManager<FloatingOverlayView>() {

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): FloatingOverlayView {
    return FloatingOverlayView(context)
  }

  companion object {
    const val NAME = "MobileAIFloatingOverlay"
  }
}
