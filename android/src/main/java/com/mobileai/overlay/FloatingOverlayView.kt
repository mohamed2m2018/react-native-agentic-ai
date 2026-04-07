package com.mobileai.overlay

import android.app.Activity
import android.app.Dialog
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import com.facebook.react.bridge.ReactContext

/**
 * FloatingOverlayView — A ViewGroup that renders its children in an elevated
 * Dialog window using WindowManager.LayoutParams.TYPE_APPLICATION_PANEL.
 *
 * Architecture:
 * TYPE_APPLICATION_PANEL (z=1000) sits above normal app windows (TYPE_APPLICATION, z=2)
 * AND above React Native's <Modal> Dialog windows (also TYPE_APPLICATION), because
 * TYPE_APPLICATION_PANEL explicitly describes a panel that floats above its parent
 * application window. No SYSTEM_ALERT_WINDOW permission required — the panel is
 * scoped to the consuming app's own window hierarchy.
 *
 * Used by both Old Arch (FloatingOverlayViewManager) and New Arch Fabric implementations.
 */
class FloatingOverlayView(context: Context) : ViewGroup(context) {

  private var overlayDialog: Dialog? = null

  // All RN children are placed in this container inside the Dialog
  private val contentContainer = FrameLayout(context)

  // ─── Lifecycle ──────────────────────────────────────────────

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    showOverlay()
  }

  override fun onDetachedFromWindow() {
    dismissOverlay()
    super.onDetachedFromWindow()
  }

  // ─── Overlay management ──────────────────────────────────────

  private fun showOverlay() {
    val activity = getActivity() ?: return

    overlayDialog = Dialog(activity, android.R.style.Theme_Translucent_NoTitleBar).also { dialog ->
      dialog.window?.let { window ->
        // TYPE_APPLICATION_PANEL: sub-window panel above its application window.
        // Requires the parent window's token — no SYSTEM_ALERT_WINDOW needed.
        window.setType(WindowManager.LayoutParams.TYPE_APPLICATION_PANEL)

        // Anchor to the Activity's root decor view token.
        // This makes our panel a child of the main window,
        // floating above it and above any Dialogs (which are peers of the main window).
        val attrs = window.attributes
        attrs.token = activity.window.decorView.windowToken
        window.attributes = attrs

        window.setLayout(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT
        )
        window.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))

        // FLAG_NOT_FOCUSABLE: don't steal keyboard focus from the underlying app.
        // Keyboard inputs (TextInput in the chat bar) still work because
        // the chat bar's own TextInput will request focus explicitly when tapped.
        window.addFlags(WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE)

        // FLAG_NOT_TOUCH_MODAL: allow touches outside our visible UI to reach the
        // underlying app / dialog windows. Without this, any touch on the transparent
        // areas of our overlay would be consumed and swallowed.
        window.addFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL)

        window.addFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED)
      }

      dialog.setContentView(contentContainer)
      dialog.setCanceledOnTouchOutside(false)
      dialog.show()
    }
  }

  private fun dismissOverlay() {
    try {
      if (overlayDialog?.isShowing == true) {
        overlayDialog?.dismiss()
      }
    } catch (e: Exception) {
      // Activity may already be finishing — safe to ignore crash
    } finally {
      overlayDialog = null
    }
  }

  // ─── Child view forwarding ───────────────────────────────────
  // React Native's layout engine sees THIS ViewGroup, but actual rendering
  // happens in the Dialog's contentContainer.
  // We forward all child management calls to maintain RN's expectations.

  override fun addView(child: View) {
    contentContainer.addView(child)
  }

  override fun addView(child: View, index: Int) {
    contentContainer.addView(child, index)
  }

  override fun addView(child: View, params: ViewGroup.LayoutParams) {
    contentContainer.addView(child, params)
  }

  override fun addView(child: View, index: Int, params: ViewGroup.LayoutParams) {
    contentContainer.addView(child, index, params)
  }

  override fun removeView(view: View) {
    contentContainer.removeView(view)
  }

  override fun removeViewAt(index: Int) {
    contentContainer.removeViewAt(index)
  }

  override fun getChildCount(): Int = contentContainer.childCount

  override fun getChildAt(index: Int): View? = contentContainer.getChildAt(index)

  // ─── Layout ──────────────────────────────────────────────────

  // The Dialog manages sizing (MATCH_PARENT) — this View itself is invisible
  // in the main window and only serves as an anchor.
  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) { /* no-op */ }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    super.onMeasure(widthMeasureSpec, heightMeasureSpec)
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private fun getActivity(): Activity? {
    // ReactContext knows the current Activity
    return (context as? ReactContext)?.currentActivity
      ?: (context as? Activity)
  }
}
