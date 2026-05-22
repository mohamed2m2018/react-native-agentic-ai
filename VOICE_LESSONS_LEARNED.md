# Voice Agent — Lessons Learned

Hard-won lessons from building the Gemini Live API voice agent with `gemini-2.5-flash-native-audio-preview-12-2025`.

---

## 1. 1008 Crash: Speech + Tool Call in Same Turn

**Problem:** The model crashes (WebSocket code 1008 — "Operation is not implemented, or supported, or enabled") whenever it tries to **speak audio AND call a function tool in the same response turn**.

**Pattern:**
- ✅ Tool-only turn (no speech before tool) → works
- ✅ Speech-only turn (answer a question) → works
- ❌ Speech first, then tool call → **crash every time**

**Example:** User asks "recommend burgers" → model says "Sure, tapping on Burgers to see what's available..." → tries to call `tap([5])` → 1008 crash. But "disable notifications" → model directly calls `navigate("Settings")` → works.

**Root cause:** Server-side bug in the `-12-2025` preview model. The server cannot handle interleaved audio output and function call output in a single turn.

**Fix:** System prompt enforces **tool-first protocol** — emit the function call immediately before any speech. Speak only after getting the tool result back.

```
CRITICAL — tool call protocol:
Emit the function call IMMEDIATELY — before any speech or audio output.
Speaking before a tool call causes a fatal connection error.
Correct: [function call] → receive result → speak to user.
Wrong: "Sure, let me tap on..." → [function call] → crash.
```

---

## 2. 1008 Crash: Audio Input During Tool Execution

**Problem:** The mic keeps streaming audio to the server via `sendRealtimeInput` while a tool call is pending. The server rejects audio input during tool processing and kills the WebSocket.

**Fix:** Gate audio input — stop the mic when a tool call arrives, resume after `sendToolResponse` is sent.

```typescript
// In onToolCall handler:
audioInputRef.current?.stop();   // Pause mic
// ... execute tool, send response ...
audioInputRef.current?.start();  // Resume mic
```

---

## 3. Auto-Navigation on Screen Context

**Problem:** When the model receives the initial screen context, it sometimes acts on its own — navigating or tapping elements without the user requesting anything.

**Fix — two layers:**

1. **Prompt:** Passive context prefix: `[SYSTEM CONTEXT — DO NOT RESPOND. DO NOT NAVIGATE. DO NOT CALL ANY TOOLS. DO NOT SPEAK. Just silently read and memorize this screen layout.]`

2. **Code gate:** `userHasSpokenRef` flag — tool calls are rejected at the code level until user speech is detected. This is deterministic and model-proof.

```typescript
if (!userHasSpokenRef.current) {
  sendFunctionResponse(toolCall.id, { result: 'Action rejected: wait for user.' });
  return;
}
```

---

## 4. Voice vs Text Mode: Timing Differences

**Problem:** Text mode works perfectly because it re-reads the screen at the START of each step (after the HTTP round-trip gives React time to re-render). Voice mode reads context immediately after tool execution, before React has re-rendered.

**Key differences:**

| Aspect | Text Mode | Voice Mode |
|--------|-----------|------------|
| Screen read timing | Start of each step (after HTTP delay) | Immediately after tool execution |
| Tool execution | One per step, enforced | Could fire multiple in parallel |
| Natural delay | HTTP round-trip (1-3s) | None |

**Fix:** Added 300ms step delay + tool lock (one-at-a-time enforcement) + enriched tool response with `<updated_screen>` context.

---

## 5. Tool Delay Patterns

**Problem:** The `type` tool calls `onChangeText` on a text input, but React's `setState` hasn't flushed yet when the screen is immediately re-read.

**Discovery:** The `navigate` tool already had a 500ms built-in delay. The `tap` tool already had 500ms on every branch. Only `type` was missing it.

**Fix:** Added 500ms delay to `type` tool, matching the existing pattern in `navigate` and `tap`.

---

## 6. Model Name Compatibility (Google AI vs Vertex AI)

**Problem:** `gemini-live-2.5-flash-native-audio` is a **Vertex AI model name**. It doesn't exist on the Google AI SDK (`v1beta` or `v1alpha`). The error: "model not found for API version v1beta."

**Lesson:** Always verify model names are valid for your specific API endpoint. The Google AI SDK (ai.google.dev) and Vertex AI have different model name formats:
- Google AI: `gemini-2.5-flash-native-audio-preview-12-2025`
- Vertex AI: `gemini-live-2.5-flash-native-audio`

---

## 7. Transcription vs Tool Calling Compatibility

**Initially suspected** that `inputAudioTranscription` / `outputAudioTranscription` was incompatible with tool declarations. **This was wrong.** Logs proved that tool calls succeeded with both transcriptions enabled (lines 19387-22929 in the session log).

**Lesson:** Don't guess. Check the logs for when things actually worked, compare the exact config with when they broke. The 1008 crash was caused by the speech+tool race condition (lesson #1), not transcription config.

---

## 8. Debugging Methodology

**What didn't work:** Guessing, theorizing, applying "obvious" fixes without evidence.

**What worked:**
1. **Check logs for WORKING sessions** — find when the exact same feature DID work
2. **Diff the configs** — compare SDK config between working and broken sessions
3. **Trace the exact sequence** — what SDK messages arrived right before the crash
4. **Check community reports** — search for the exact error code + model name
5. **The user knows more than you think** — when they say "it worked when I disabled notifications," that's a critical clue about WHICH commands work vs crash

---

## Summary of All Changes

| File | Change | Purpose |
|------|--------|---------|
| `systemPrompt.ts` | Tool-first protocol in prompt | Prevents speech+tool crash |
| `AIAgent.tsx` | `userHasSpokenRef` gate | Prevents auto-navigation |
| `AIAgent.tsx` | `toolLockRef` serialization | One tool at a time |
| `AIAgent.tsx` | Audio input gating in `onToolCall` | Prevents 1008 during tool exec |
| `AgentRuntime.ts` | 500ms delay in `type` tool | Matches navigate/tap pattern |
