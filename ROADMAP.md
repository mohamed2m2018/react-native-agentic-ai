# Roadmap

This file is the public roadmap for the SDK. Items link to GitHub issues where applicable.

## Shipped

- Three autonomy levels (companion / copilot / autopilot).
- Screen-aware tree walking with `FiberTreeWalker`.
- Generated screen map (`ai-screen-map.json`) via the `generate-map` CLI.
- Route awareness via `navRef` (React Navigation, Expo Router).
- Runtime guardrail pipeline: consent, masking, semantic action safety, approval, outcome verification.
- Provider factory with Gemini and OpenAI transports; custom transport supported.
- MCP server inside the package (`npx -y react-native-agentic-ai`), bring-your-own model key.
- Callback-based integrations: `onEvent`, `conversationStore`, `onEscalate` (0.10).
- Public security disclosure policy (`SECURITY.md`).
- Public roadmap (this file).

## In progress

- SDK 1.0 — locking in the public API for a stable 1.0 release. Strict semver going forward, with a typed migration codemod alongside.

## Planned

- On-device inference (preview) — small-model fast path with cloud fallback.

Targets on the public roadmap are listed when committed. The page is updated as work lands.

## How to influence the roadmap

- Open an issue on the GitHub repository with the use case.
- Security-affecting items: see [`SECURITY.md`](./SECURITY.md).
