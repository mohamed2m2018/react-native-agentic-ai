---
name: install-mobileai-react-native
description: Generic AI-agent skill for installing and wiring the @mobileai/react-native SDK into Expo or React Native apps. Use when a coding assistant needs to add MobileAI, install the React Native AI support agent, configure AIAgent, enable screen mapping, set up voice/dictation/human escalation dependencies, troubleshoot native install errors, or migrate an app from manual provider keys to hosted MobileAI proxy defaults.
---

# Install MobileAI React Native

This is a generic AI-agent skill. It is intentionally not tied to one assistant or IDE; any coding agent can read this folder and follow the workflow.

## Workflow

1. Inspect the host app before changing files:
   - package manager and lockfile
   - Expo managed/prebuild vs React Native CLI
   - React Native version
   - navigation style: React Navigation or Expo Router
   - existing `metro.config.js`, `app.json`/`app.config.*`, root app entry, and environment handling
2. Install the base SDK:
   - npm: `npm install @mobileai/react-native`
   - yarn: `yarn add @mobileai/react-native`
   - pnpm: `pnpm add @mobileai/react-native`
3. Use `references/installation.md` for exact commands, wrapper snippets, optional dependencies, and troubleshooting.
4. Prefer hosted MobileAI defaults when an `analyticsKey` is available. Do not add direct provider keys to app code unless the user explicitly asks for prototype-only local keys.
5. Rebuild the native app after install; Expo Go is not supported because the SDK includes native modules.

## Implementation Rules

- Wrap the existing app with `<AIAgent>` without changing screen internals.
- Pass `navRef` and `screenMap` when navigation context is available.
- Enable screen map generation with `require('@mobileai/react-native/generate-map').autoGenerate(__dirname);` in `metro.config.js` when possible.
- Use `analyticsKey="mobileai_pub_..."` as the default production setup; it automatically configures hosted text and voice proxy defaults.
- Add optional dependencies only for requested features:
  - `expo-speech-recognition` for dictation in text mode
  - `react-native-audio-api` plus microphone permissions for Voice mode
  - `@react-native-async-storage/async-storage` only when the app sets `consent.persist` and wants AI consent remembered across app restarts; do not install it for tickets, discovery tooltip state, telemetry, or conversation history.

## Validation

- Run the host app’s typecheck/test command if available.
- For Expo, run `npx expo prebuild` only if the project already uses prebuild/dev builds or the user asked to prepare native projects.
- Confirm imports resolve from `@mobileai/react-native`.
- Confirm the app root still renders and the floating chat bar appears unless `showChatBar={false}` is intentional.
