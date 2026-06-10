package com.mobileai.overlay

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactStylesDiffMap
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.StateWrapper
import com.facebook.react.uimanager.events.EventDispatcher
import com.facebook.react.viewmanagers.MobileAIFloatingOverlayManagerDelegate
import com.facebook.react.viewmanagers.MobileAIFloatingOverlayManagerInterface

/**
 * New Architecture (Fabric) ViewManager for MobileAIFloatingOverlay.
 *
 * Used when newArchEnabled=true in the consuming app's gradle.properties.
 * Loaded via the newarch/ sourceSet in build.gradle.
 *
 * Fabric mounts this component as a ViewGroup, so the manager must expose the
 * ViewGroup contract rather than SimpleViewManager.
 */
class FloatingOverlayViewManager(
  private val reactApplicationContext: ReactApplicationContext
) : ViewGroupManager<FloatingOverlayView>(),
  MobileAIFloatingOverlayManagerInterface<FloatingOverlayView> {

  private val delegate: ViewManagerDelegate<FloatingOverlayView> =
    MobileAIFloatingOverlayManagerDelegate(this)

  override fun getDelegate(): ViewManagerDelegate<FloatingOverlayView> = delegate

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

  override fun setWindowX(view: FloatingOverlayView, value: Int) {
    view.setWindowX(value)
  }

  override fun setWindowY(view: FloatingOverlayView, value: Int) {
    view.setWindowY(value)
  }

  override fun setWindowWidth(view: FloatingOverlayView, value: Int) {
    view.setWindowWidth(value)
  }

  override fun setWindowHeight(view: FloatingOverlayView, value: Int) {
    view.setWindowHeight(value)
  }

  companion object {
    const val NAME = "MobileAIFloatingOverlay"
  }
}
