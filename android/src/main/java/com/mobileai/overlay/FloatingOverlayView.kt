package com.mobileai.overlay

import android.app.Activity
import android.app.Dialog
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.view.WindowManager
import android.widget.FrameLayout
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.uimanager.StateWrapper
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.events.EventDispatcher
import com.facebook.react.bridge.ReactContext
import kotlin.math.roundToInt

/**
 * FloatingOverlayView — hosts React children inside an Android panel dialog so
 * the agent can float above app content and native modal surfaces without
 * taking ownership of the full React root view.
 */
class FloatingOverlayView(context: Context) : ViewGroup(context) {
  private var showPopupPosted: Boolean = false
  private var overlayDialog: Dialog? = null
  private var windowX: Int = 0
  private var windowY: Int = 0
  private var windowWidth: Int = 0
  private var windowHeight: Int = 0

  var eventDispatcher: EventDispatcher?
    get() = dialogRootViewGroup.eventDispatcher
    set(value) {
      dialogRootViewGroup.eventDispatcher = value
    }

  var stateWrapper: StateWrapper?
    get() = dialogRootViewGroup.stateWrapper
    set(value) {
      dialogRootViewGroup.stateWrapper = value
    }

  init {
    isClickable = false
    isFocusable = false
    isFocusableInTouchMode = false
    visibility = View.GONE
    setBackgroundColor(Color.TRANSPARENT)
  }

  private val dialogRootViewGroup = FloatingOverlayDialogRootViewGroup(context)

  private val contentView = FrameLayout(context).apply {
    layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    setBackgroundColor(Color.TRANSPARENT)
    addView(
      dialogRootViewGroup,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
      )
    )
  }

  init {
    dialogRootViewGroup.overlayHost = this
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    scheduleShowPopup()
  }

  override fun onDetachedFromWindow() {
    dismissPopup()
    super.onDetachedFromWindow()
  }

  override fun setId(id: Int) {
    super.setId(id)
    dialogRootViewGroup.id = id
  }

  fun setWindowX(value: Int) {
    val pxValue = dpToPx(value)
    if (windowX == pxValue) return
    windowX = pxValue
    updatePopupPosition()
  }

  fun setWindowY(value: Int) {
    val pxValue = dpToPx(value)
    if (windowY == pxValue) return
    windowY = pxValue
    updatePopupPosition()
  }

  fun setWindowWidth(value: Int) {
    val normalized = dpToPx(value.coerceAtLeast(1))
    if (windowWidth == normalized) return
    windowWidth = normalized
    updatePopupLayout()
  }

  fun setWindowHeight(value: Int) {
    val normalized = dpToPx(value.coerceAtLeast(1))
    if (windowHeight == normalized) return
    windowHeight = normalized
    updatePopupLayout()
  }

  override fun addView(child: View) {
    dialogRootViewGroup.addView(child)
  }

  override fun addView(child: View, index: Int) {
    dialogRootViewGroup.addView(child, index)
  }

  override fun addView(child: View, params: ViewGroup.LayoutParams) {
    dialogRootViewGroup.addView(child, params)
  }

  override fun addView(child: View, index: Int, params: ViewGroup.LayoutParams) {
    dialogRootViewGroup.addView(child, index, params)
  }

  override fun removeView(view: View) {
    dialogRootViewGroup.removeView(view)
  }

  override fun removeViewAt(index: Int) {
    dialogRootViewGroup.removeView(getChildAt(index))
  }

  override fun getChildCount(): Int = dialogRootViewGroup.childCount

  override fun getChildAt(index: Int): View? = dialogRootViewGroup.getChildAt(index)

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) { /* anchor only */ }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(0, 0)
  }

  override fun dispatchTouchEvent(event: MotionEvent?): Boolean = false

  override fun onInterceptTouchEvent(event: MotionEvent?): Boolean = false

  override fun onTouchEvent(event: MotionEvent?): Boolean = false

  fun onDropInstance() {
    dismissPopup()
  }

  internal fun getWindowXPx(): Int = windowX

  internal fun getWindowYPx(): Int = windowY

  internal fun updateWindowPositionFromNative(x: Int, y: Int) {
    val (clampedX, clampedY) = clampPopupPosition(x, y)
    if (windowX == clampedX && windowY == clampedY) return
    windowX = clampedX
    windowY = clampedY
    updatePopupPosition()
  }

  internal fun emitWindowDragEnd() {
    val reactContext = context as? ReactContext ?: return
    val payload = Arguments.createMap().apply {
      putInt("viewId", id)
      putInt("x", pxToDp(windowX))
      putInt("y", pxToDp(windowY))
      putInt("width", pxToDp(resolvePopupWidth()))
      putInt("height", pxToDp(resolvePopupHeight()))
    }

    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(WINDOW_DRAG_END_EVENT, payload)
  }

  private fun showPopup() {
    showPopupPosted = false

    val activity = getActivity()
    if (activity == null) {
      scheduleShowPopup()
      return
    }

    val decorView = activity.window?.decorView
    if (decorView == null) {
      scheduleShowPopup()
      return
    }

    if (!decorView.isAttachedToWindow) {
      scheduleShowPopup()
      return
    }

    if (overlayDialog == null || overlayDialog?.context !== activity) {
      dismissPopup()
      (contentView.parent as? ViewGroup)?.removeView(contentView)

      overlayDialog = Dialog(activity).apply {
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        setCancelable(false)
        setCanceledOnTouchOutside(false)
        setContentView(contentView)

        window?.apply {
          setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
          clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
          addFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL)
          setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
          val params = attributes
          params.type = WindowManager.LayoutParams.TYPE_APPLICATION_PANEL
          params.token = decorView.applicationWindowToken
          attributes = params
          setGravity(Gravity.TOP or Gravity.START)
          setWindowAnimations(0)
        }
      }
    }

    updatePopupLayout()

    val dialog = overlayDialog ?: return
    if (!dialog.isShowing && activity.isFinishing.not()) {
      dialog.show()
      updatePopupLayout()
    }
  }

  private fun updatePopupLayout() {
    val dialog = overlayDialog
    if (dialog == null) {
      scheduleShowPopup()
      return
    }

    val width = resolvePopupWidth()
    val height = resolvePopupHeight()

    contentView.layoutParams = FrameLayout.LayoutParams(width, height)
    dialogRootViewGroup.layoutParams = FrameLayout.LayoutParams(width, height)
    val widthSpec = MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY)
    val heightSpec = MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
    contentView.measure(widthSpec, heightSpec)
    contentView.layout(0, 0, width, height)
    dialogRootViewGroup.measure(widthSpec, heightSpec)
    dialogRootViewGroup.layout(0, 0, width, height)
    dialogRootViewGroup.updateState(width, height)
    contentView.requestLayout()

    updatePopupPosition()
  }

  private fun updatePopupPosition() {
    val dialog = overlayDialog
    if (dialog == null) {
      scheduleShowPopup()
      return
    }

    val width = resolvePopupWidth()
    val height = resolvePopupHeight()
    val (clampedX, clampedY) = clampPopupPosition(windowX, windowY)
    windowX = clampedX
    windowY = clampedY

    dialog.window?.let { window ->
      window.setLayout(width, height)
      val params = window.attributes
      params.width = width
      params.height = height
      params.x = clampedX
      params.y = clampedY
      params.gravity = Gravity.TOP or Gravity.START
      window.attributes = params
    }
  }

  private fun dismissPopup() {
    try {
      overlayDialog?.dismiss()
    } catch (_: Exception) {
      // The host activity may already be shutting down.
    } finally {
      showPopupPosted = false
      overlayDialog = null
      (contentView.parent as? ViewGroup)?.removeView(contentView)
    }
  }

  private fun scheduleShowPopup() {
    if (showPopupPosted) return
    showPopupPosted = true
    post { showPopup() }
  }

  private fun resolvePopupWidth(): Int = windowWidth.coerceAtLeast(1)

  private fun resolvePopupHeight(): Int = windowHeight.coerceAtLeast(1)

  private fun clampPopupPosition(x: Int, y: Int): Pair<Int, Int> {
    val screenInset = dpToPx(10)
    val bottomInset = dpToPx(24)
    val decorView = getActivity()?.window?.decorView
    val screenWidth = decorView?.width?.takeIf { it > 0 } ?: resources.displayMetrics.widthPixels
    val screenHeight = decorView?.height?.takeIf { it > 0 } ?: resources.displayMetrics.heightPixels
    val maxX = maxOf(screenInset, screenWidth - resolvePopupWidth() - screenInset)
    val maxY = maxOf(screenInset, screenHeight - resolvePopupHeight() - bottomInset)

    return Pair(
      x.coerceIn(screenInset, maxX),
      y.coerceIn(screenInset, maxY),
    )
  }

  private fun getActivity(): Activity? {
    return (context as? ThemedReactContext)?.currentActivity
      ?: (context as? ReactContext)?.currentActivity
      ?: (context as? Activity)
  }

  private fun dpToPx(value: Int): Int {
    return (value * resources.displayMetrics.density).roundToInt()
  }

  private fun pxToDp(value: Int): Int {
    return (value / resources.displayMetrics.density).roundToInt()
  }

  companion object {
    const val WINDOW_DRAG_END_EVENT = "mobileaiFloatingOverlayDragEnd"
  }
}
