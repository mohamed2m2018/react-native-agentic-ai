package com.mobileai.overlay

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactStylesDiffMap
import com.facebook.react.uimanager.StateWrapper
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.EventDispatcher

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
) : ViewGroupManager<FloatingOverlayView>() {

  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): FloatingOverlayView {
    return FloatingOverlayView(context)
  }

  override fun onDropViewInstance(view: FloatingOverlayView) {
    super.onDropViewInstance(view)
    view.onDropInstance()
  }

  override fun addEventEmitters(reactContext: ThemedReactContext, view: FloatingOverlayView) {
    val dispatcher: EventDispatcher? =
      UIManagerHelper.getEventDispatcherForReactTag(reactContext, view.id)
    if (dispatcher != null) {
      view.eventDispatcher = dispatcher
    }
  }

  override fun updateState(
    view: FloatingOverlayView,
    props: ReactStylesDiffMap,
    stateWrapper: StateWrapper,
  ): Any? {
    view.stateWrapper = stateWrapper
    return null
  }

  @ReactProp(name = "windowX", defaultInt = 0)
  fun setWindowX(view: FloatingOverlayView, value: Int) {
    view.setWindowX(value)
  }

  @ReactProp(name = "windowY", defaultInt = 0)
  fun setWindowY(view: FloatingOverlayView, value: Int) {
    view.setWindowY(value)
  }

  @ReactProp(name = "windowWidth", defaultInt = 0)
  fun setWindowWidth(view: FloatingOverlayView, value: Int) {
    view.setWindowWidth(value)
  }

  @ReactProp(name = "windowHeight", defaultInt = 0)
  fun setWindowHeight(view: FloatingOverlayView, value: Int) {
    view.setWindowHeight(value)
  }

  companion object {
    const val NAME = "MobileAIFloatingOverlay"
  }
}
