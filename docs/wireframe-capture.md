# Wireframe Capture — SDK Architecture

Privacy-safe structural UI capture for heatmap context. No screenshots, no PII.

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
 └── Queue as 'wireframe_snapshot' event in telemetry batch
     │
     ▼
POST /api/v1/events → Dashboard ingests into wireframe_snapshots table
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
