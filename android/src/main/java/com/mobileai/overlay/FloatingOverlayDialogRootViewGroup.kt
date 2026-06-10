package com.mobileai.overlay

import android.annotation.SuppressLint
import android.content.Context
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import com.facebook.react.bridge.GuardedRunnable
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.common.annotations.UnstableReactNativeAPI
import com.facebook.react.common.build.ReactBuildConfig
import com.facebook.react.config.ReactFeatureFlags
import com.facebook.react.uimanager.JSPointerDispatcher
import com.facebook.react.uimanager.JSTouchDispatcher
import com.facebook.react.uimanager.PixelUtil.pxToDp
import com.facebook.react.uimanager.RootView
import com.facebook.react.uimanager.StateWrapper
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerModule
import com.facebook.react.uimanager.events.EventDispatcher
import com.facebook.react.views.view.ReactViewGroup
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Root view rendered inside the Android floating panel dialog.
 *
 * This mirrors the touch and layout behavior of React Native's modal dialog
 * host so JS children remain fully interactive even though they render inside
 * a separate native window.
 */
internal class FloatingOverlayDialogRootViewGroup(context: Context) :
  ReactViewGroup(context),
  RootView {

  var stateWrapper: StateWrapper? = null
  var eventDispatcher: EventDispatcher? = null
  var overlayHost: FloatingOverlayView? = null

  private var viewWidth: Int = 0
  private var viewHeight: Int = 0
  private val jsTouchDispatcher = JSTouchDispatcher(this)
  private var jsPointerDispatcher: JSPointerDispatcher? = null
  private val touchSlop: Float = ViewConfiguration.get(context).scaledTouchSlop.toFloat()
  private var dragCandidate: Boolean = false
  private var isDraggingWindow: Boolean = false
  private var dragStartRawX: Float = 0f
  private var dragStartRawY: Float = 0f
  private var dragStartWindowX: Int = 0
  private var dragStartWindowY: Int = 0

  private val reactContext: ThemedReactContext
    get() = context as ThemedReactContext

  init {
    if (ReactFeatureFlags.dispatchPointerEvents) {
      jsPointerDispatcher = JSPointerDispatcher(this)
    }
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    viewWidth = w
    viewHeight = h
    updateState(viewWidth, viewHeight)
  }

  fun updateState(width: Int, height: Int) {
    val realWidth = width.toFloat().pxToDp()
    val realHeight = height.toFloat().pxToDp()

    val wrapper = stateWrapper
    if (wrapper != null) {
      val newStateData: WritableMap = WritableNativeMap()
      newStateData.putDouble("screenWidth", realWidth.toDouble())
      newStateData.putDouble("screenHeight", realHeight.toDouble())
      wrapper.updateState(newStateData)
    } else if (
      !ReactBuildConfig.UNSTABLE_ENABLE_MINIFY_LEGACY_ARCHITECTURE &&
      !reactContext.isBridgeless
    ) {
      @Suppress("DEPRECATION")
      reactContext.runOnNativeModulesQueueThread(
        object : GuardedRunnable(reactContext) {
          override fun runGuarded() {
            reactContext.reactApplicationContext
              .getNativeModule(UIManagerModule::class.java)
              ?.updateNodeSize(id, viewWidth, viewHeight)
          }
        }
      )
    }
  }

  override fun handleException(t: Throwable) {
    reactContext.reactApplicationContext.handleException(RuntimeException(t))
  }

  override fun onInterceptTouchEvent(event: MotionEvent): Boolean {
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        dragCandidate = isInNativeDragRegion(event.x, event.y)
        isDraggingWindow = false
        if (dragCandidate) {
          dragStartRawX = event.rawX
          dragStartRawY = event.rawY
          dragStartWindowX = overlayHost?.getWindowXPx() ?: 0
          dragStartWindowY = overlayHost?.getWindowYPx() ?: 0
        }
      }

      MotionEvent.ACTION_MOVE -> {
        if (dragCandidate && !isDraggingWindow && hasExceededTouchSlop(event)) {
          isDraggingWindow = true
          parent?.requestDisallowInterceptTouchEvent(true)
          updateNativeWindowDrag(event)
          return true
        }
      }

      MotionEvent.ACTION_UP,
      MotionEvent.ACTION_CANCEL -> resetNativeDrag()
    }

    if (isDraggingWindow) return true

    eventDispatcher?.let { dispatcher ->
      jsTouchDispatcher.handleTouchEvent(event, dispatcher, reactContext)
      jsPointerDispatcher?.handleMotionEvent(event, dispatcher, true)
    }
    return super.onInterceptTouchEvent(event)
  }

  @SuppressLint("ClickableViewAccessibility")
  override fun onTouchEvent(event: MotionEvent): Boolean {
    if (isDraggingWindow || dragCandidate) {
      when (event.actionMasked) {
        MotionEvent.ACTION_MOVE -> {
          if (!isDraggingWindow && hasExceededTouchSlop(event)) {
            isDraggingWindow = true
            parent?.requestDisallowInterceptTouchEvent(true)
          }

          if (isDraggingWindow) {
            updateNativeWindowDrag(event)
            return true
          }
        }

        MotionEvent.ACTION_UP -> {
          if (isDraggingWindow) {
            updateNativeWindowDrag(event)
            overlayHost?.emitWindowDragEnd()
            resetNativeDrag()
            return true
          }
          resetNativeDrag()
        }

        MotionEvent.ACTION_CANCEL -> {
          if (isDraggingWindow) {
            overlayHost?.emitWindowDragEnd()
            resetNativeDrag()
            return true
          }
          resetNativeDrag()
        }
      }
    }

    eventDispatcher?.let { dispatcher ->
      jsTouchDispatcher.handleTouchEvent(event, dispatcher, reactContext)
      jsPointerDispatcher?.handleMotionEvent(event, dispatcher, false)
    }
    super.onTouchEvent(event)
    return true
  }

  override fun onInterceptHoverEvent(event: MotionEvent): Boolean {
    eventDispatcher?.let { dispatcher ->
      jsPointerDispatcher?.handleMotionEvent(event, dispatcher, true)
    }
    return super.onInterceptHoverEvent(event)
  }

  override fun onHoverEvent(event: MotionEvent): Boolean {
    eventDispatcher?.let { dispatcher ->
      jsPointerDispatcher?.handleMotionEvent(event, dispatcher, false)
    }
    return super.onHoverEvent(event)
  }

  @OptIn(UnstableReactNativeAPI::class)
  override fun onChildStartedNativeGesture(childView: View?, ev: MotionEvent) {
    eventDispatcher?.let { dispatcher ->
      jsTouchDispatcher.onChildStartedNativeGesture(ev, dispatcher, reactContext)
      jsPointerDispatcher?.onChildStartedNativeGesture(childView, ev, dispatcher)
    }
  }

  override fun onChildEndedNativeGesture(childView: View, ev: MotionEvent) {
    eventDispatcher?.let { dispatcher ->
      jsTouchDispatcher.onChildEndedNativeGesture(ev, dispatcher)
    }
    jsPointerDispatcher?.onChildEndedNativeGesture()
  }

  override fun requestDisallowInterceptTouchEvent(disallowIntercept: Boolean) {
    // No-op so the root can continue receiving events for JS dispatch.
  }

  private fun hasExceededTouchSlop(event: MotionEvent): Boolean {
    return abs(event.rawX - dragStartRawX) > touchSlop || abs(event.rawY - dragStartRawY) > touchSlop
  }

  private fun updateNativeWindowDrag(event: MotionEvent) {
    val targetX = dragStartWindowX + (event.rawX - dragStartRawX).roundToInt()
    val targetY = dragStartWindowY + (event.rawY - dragStartRawY).roundToInt()
    overlayHost?.updateWindowPositionFromNative(targetX, targetY)
  }

  private fun resetNativeDrag() {
    dragCandidate = false
    isDraggingWindow = false
  }

  private fun isInNativeDragRegion(x: Float, y: Float): Boolean {
    if (viewWidth <= dpToPx(80) && viewHeight <= dpToPx(80)) {
      return true
    }

    val handleTop = dpToPx(44)
    val handleHalfWidth = dpToPx(72)
    val centerX = viewWidth / 2f

    return y <= handleTop && x in (centerX - handleHalfWidth)..(centerX + handleHalfWidth)
  }

  private fun dpToPx(value: Int): Float {
    return value * resources.displayMetrics.density
  }
}
