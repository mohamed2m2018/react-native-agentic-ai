---
name: install-react-native-agentic-ai
description: Generic AI-agent skill for installing and wiring the react-native-agentic-ai SDK into Expo or React Native apps. Use when a coding assistant needs to add the React Native AI agent, configure AIAgent, connect it to a model provider or the app's backend proxy, enable screen mapping, set up voice/dictation or human escalation, or troubleshoot native install errors.
---

# Install React Native Agentic AI

This is a generic AI-agent skill. It is intentionally not tied to one assistant or IDE; any coding agent can read this folder and follow the workflow.

## Workflow

1. Inspect the host app before changing files:
   - package manager and lockfile
   - Expo managed/prebuild vs React Native CLI
   - React Native version
   - navigation style: React Navigation or Expo Router
   - existing `metro.config.js`, `app.json`/`app.config.*`, root app entry, and environment handling
2. Install the base SDK:
   - npm: `npm install react-native-agentic-ai`
   - yarn: `yarn add react-native-agentic-ai`
   - pnpm: `pnpm add react-native-agentic-ai`
3. Use `references/installation.md` for exact commands, wrapper snippets, optional dependencies, and troubleshooting.
4. Prefer `proxyUrl` pointing at the app's own backend. Use `apiKey` only for development builds, read from an environment variable, never hard-coded.
5. Rebuild the native app after install; Expo Go is not supported because the SDK includes native modules.

## Implementation Rules

- Wrap the existing app with `<AIAgent>` without changing screen internals.
- Pass `navRef` and `screenMap` when navigation context is available.
- Enable screen map generation with `require('react-native-agentic-ai/generate-map').autoGenerate(__dirname);` in `metro.config.js` when possible.
- Use `provider` plus `proxyUrl` (and `voiceProxyUrl` for voice) as the production setup; the app's backend adds the real provider key.
- For human escalation, pass `supportMode.escalation.onEscalate`; for analytics, `onEvent`; for chat history, `conversationStore`.
- Add optional dependencies only for requested features:
  - `expo-speech-recognition` for dictation in text mode
  - `react-native-audio-api` plus microphone permissions for Voice mode
  - `@react-native-async-storage/async-storage` only when the app sets `consent.persist` and wants AI consent remembered across app restarts; do not install it for discovery tooltip state or telemetry.

## Validation

- Run the host app’s typecheck/test command if available.
- For Expo, run `npx expo prebuild` only if the project already uses prebuild/dev builds or the user asked to prepare native projects.
- Confirm imports resolve from `react-native-agentic-ai`.
- Confirm the app root still renders and the floating chat bar appears unless `showChatBar={false}` is intentional.
