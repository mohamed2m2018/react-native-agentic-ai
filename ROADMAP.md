# Roadmap

The public roadmap lives at [`https://mobileai.cloud/roadmap`](https://mobileai.cloud/roadmap). It links to public GitHub issues where applicable.

This file is a snapshot of the SDK-facing items so it stays useful when reading the package on npm or GitHub.

## Shipped

- Three autonomy levels (companion / copilot / autopilot).
- Screen-aware tree walking with `FiberTreeWalker`.
- Generated screen map (`ai-screen-map.json`) via the `generate-map` CLI.
- Route awareness via `navRef` (React Navigation, Expo Router).
- Runtime guardrail pipeline: consent, masking, semantic action safety, approval, outcome verification.
- Hosted control plane (`mobileai.cloud`) for KB retrieval, audit, escalation, billing.
- Provider factory with Gemini and OpenAI transports; custom transport supported.
- MCP bridge for external tool surface.
- Public security disclosure policy (`SECURITY.md`).
- Public threat model and 1-day evaluation guide (on `mobileai.cloud`).
- Public roadmap (this file mirrors the canonical version).

## In progress

- SDK 1.0 — locking in the public API for a stable 1.0 release. Strict semver going forward, with a typed migration codemod alongside.

## Planned

- On-device inference (preview) — small-model fast path with cloud fallback.
- SOC 2 Type I observation period for the hosted control plane.
- SOC 2 Type II audit (sequenced after Type I).
- EU control-plane region (`eu-central-1`).

Targets on the public roadmap are listed when committed. The page is updated as work lands.

## How to influence the roadmap

- Open an issue on the GitHub repository with the use case.
- For paid tiers, raise priority requests via your account contact.
- Security-affecting items: see [`SECURITY.md`](./SECURITY.md).
