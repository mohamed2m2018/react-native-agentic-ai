# Changelog

All notable changes to `react-native-agentic-ai` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Until 1.0, minor versions may include breaking changes — those are explicitly called out.

## [Unreleased]

## [0.10.0] - 2026-10-17

The SDK no longer depends on a hosted dashboard. Everything that used to call it is now a callback or adapter you wire to your own tools, and the package is published only as `react-native-agentic-ai`.

### Breaking
- Removed `analyticsKey`, `analyticsProxyUrl` and `analyticsProxyHeaders`, with the hosted text/voice proxy defaults and session-token exchange. Use `apiKey` (development) or your own `proxyUrl` / `voiceProxyUrl`.
- Removed the `MobileAI` analytics singleton and remote feature flags. Use the new `onEvent` prop.
- Removed dashboard-configured actions, proactive outreach messages, outbound AI calls (`outboundCalls`, `startOutboundAiCall`, `createOutboundCallTool`), issue reports (`createReportIssueTool`) and the hosted knowledge retriever (`createTwomiliaKnowledgeRetriever`). Pass your own `knowledgeBase` retriever.
- Removed live dashboard support: `EscalationSocket`, `EscalationEventSource`, the support ticket list, the "Human" chat tab, `pushToken` / `pushTokenType`, and the `SupportTicket` / `ReportedIssue*` types. `AgentMode` is now `'text' | 'voice'`.
- `supportMode.escalation.provider` is gone: escalation always goes through `onEscalate`, and the `escalate_to_human` tool is available only when `onEscalate` is set.
- The package is now `react-native-agentic-ai` only; `@mobileai/react-native` is no longer published.

### Added
- `onEvent(event)` receives every SDK event (screen views, agent steps, taps, rage clicks, escalations, ratings, knowledge misses). Nothing is sent anywhere by the SDK.
- `conversationStore` adapter (`save`, `list`, `load`, optional `end`) to persist chat history in your own storage.
- `EscalationContext` now includes the conversation history, screen flow, tool calls, `userContext` and device.
- MCP server inside the package: `npx -y react-native-agentic-ai`. It takes only `AI_PROVIDER` and `AI_API_KEY` (optional `AI_MODEL`); tools `execute_task`, `get_app_status`, `get_screen`, `list_app_tools`, `call_app_tool`. In development builds the app runs MCP tasks with that key, without proxy settings or support tools.
- Gemini: prior agent steps are replayed as real function-call turns carrying the model's `thoughtSignature` (Gemini 3.x tool-call continuity).
- Agent findings stated with `guide_user` `action="verify"` are mirrored into the chat thread (`onInlineMessage`).

### Changed
- Scroll-loop convergence: the agent finishes with its last stated finding instead of scrolling until `maxSteps`.
- Approval prompts use `ask_user(collect_input=false)`; a typed answer to `collect_input=true` is never permission to act.
- Conversation messages carry `kind` (`chat` or `approval`).
- Screen wireframe snapshots are captured only when `onEvent` is set.

### Notes
- Restores agent changes first shipped in `react-native-agentic-ai@0.9.92`, whose source was not in git.

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
