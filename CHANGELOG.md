# Changelog

All notable changes to the MobileAI Agent SDK are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Until 1.0, minor versions may include breaking changes — those are explicitly called out.

## [Unreleased]

## [0.9.67] - 2026-05-07

### Added
- Public security policy (`SECURITY.md`).
- Public roadmap (`ROADMAP.md`, mirrors `mobileai.cloud/roadmap`).

## [0.9.66]

Current published version. See git history for prior 0.9.x changes; this entry seeds the changelog so 0.9.67+ has a starting point.

### Highlights so far in 0.9.x

- Three autonomy levels (companion / copilot / autopilot).
- FiberTreeWalker with screen-map CLI (`generate-map`).
- Guardrail pipeline: consent, masking, semantic action safety, approval, outcome verification.
- Provider factory with Gemini and OpenAI transports; custom transport supported.
- MCP bridge for external tool surface.
- Knowledge base service (local + hosted retriever).
- Human escalation with full screen context via `EscalationSocket`.
- CSAT survey and support greeting modules.
- Telemetry service with PII scrubbing.

[Unreleased]: https://github.com/MobileAIAgent/react-native/compare/v0.9.67...HEAD
[0.9.67]: https://github.com/MobileAIAgent/react-native/compare/v0.9.66...v0.9.67
[0.9.66]: https://github.com/MobileAIAgent/react-native/releases/tag/v0.9.66
