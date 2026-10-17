# Wireframe Capture — SDK Architecture

Structural UI capture for heatmap context, emitted as a `wireframe_snapshot` event. It runs only when the app passes `onEvent`. When `react-native-view-shot` is installed, the event also carries a screenshot of the screen, so treat it as sensitive data.

## Data Flow

```
Screen Change
     │
     ▼
InteractionManager.runAfterInteractions()   ← wait for idle
     │
     ▼
requestAnimationFrame()                     ← layout settled
     │
     ▼
captureWireframe()
 ├── walkFiberTree() → find interactive elements
 ├── Cap at 50 elements
 └── Measure in batches of 10, yield frame between batches
     │
     ▼
TelemetryService.trackWireframe()
 ├── Dedup: skip if screen already captured this session
 └── Emit a 'wireframe_snapshot' event
     │
     ▼
onEvent(event) → your app decides where it goes (e.g. a heatmap service)
```

## Performance Contract

| Layer | Mechanism | Guarantee |
|-------|-----------|-----------|
| Timing | `InteractionManager.runAfterInteractions` | Never runs during transitions/animations |
| Layout | `requestAnimationFrame` | Waits for layout pass to complete |
| Bridge | Batches of 10 `measure()` + `yieldFrame()` | Max 10 bridge calls per frame |
| Cap | 50 elements max | Hard upper bound on work per screen |
| Dedup | `wireframesSent` Set | Once per screen per session |
| Cleanup | `handle.cancel()` | Cancels if user navigates away |

## Privacy Contract

| Captured | NOT Captured |
|----------|-------------|
| Component type (pressable, text-input, switch) | Screen pixels / screenshots |
| Static label text (button title) | User-typed input values |
| Bounding box (x, y, w, h) | Images or icons |
| Device dimensions | User identity data |

## WireframeComponent Shape

```typescript
interface WireframeComponent {
  type: string;    // 'pressable' | 'text-input' | 'switch' | ...
  label: string;   // Static button/label text, NOT user input
  x: number;       // Absolute X on screen (px)
  y: number;       // Absolute Y on screen (px)
  width: number;
  height: number;
}
```

## Files

| File | Role |
|------|------|
| `src/core/types.ts` | `WireframeComponent`, `WireframeSnapshot` interfaces |
| `src/core/FiberTreeWalker.ts` | `captureWireframe()` — batched measurement |
| `src/services/telemetry/types.ts` | `wireframe_snapshot` event type |
| `src/services/telemetry/TelemetryService.ts` | `trackWireframe()` — dedup + queue |
| `src/components/AIAgent.tsx` | Deferred trigger on screen navigation |
