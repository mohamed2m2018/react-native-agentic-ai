# MobileAI React Native

A React Native SDK for adding an in-app AI assistant that can read your app UI, answer questions, guide users, perform approved actions, and hand off to human support.

[![npm version](https://img.shields.io/npm/v/@mobileai/react-native.svg)](https://www.npmjs.com/package/@mobileai/react-native)
[![React Native](https://img.shields.io/badge/react--native-0.83.x-blue.svg)](https://reactnative.dev/)
[![License](https://img.shields.io/badge/license-see%20LICENSE-lightgrey.svg)](./LICENSE)

![MobileAI demo](./assets/demo.gif)

## Contents

- [What the SDK does](#what-the-sdk-does)
- [Install](#install)
- [Quick start](#quick-start)
- [Core concepts](#core-concepts)
- [Guardrails](#guardrails)
- [Common recipes](#common-recipes)
- [More docs](#more-docs)
- [Requirements](#requirements)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## What The SDK Does

MobileAI adds a screen-aware assistant to your React Native app. It can:

- Understand the current screen from the React tree and optional screen map.
- Answer app-specific questions using your knowledge base and registered data sources.
- Guide users through flows in companion mode without controlling the UI.
- Perform approved UI actions in copilot mode with runtime guardrails.
- Call app-defined non-UI actions with `useAction`.
- Escalate unresolved issues to human support with conversation and screen context.

The default user-facing mode is **copilot mode**: the assistant can help with routine app steps after approval, while the runtime enforces confirmation, semantic action safety, masking, and blocked controls.

## Install

```bash
npm install @mobileai/react-native
```

Optional peers depend on the features you enable:

```bash
npm install @react-native-async-storage/async-storage react-native-screens
npm install react-native-audio-api expo-speech-recognition
```

For Expo apps, use a development build or prebuild workflow. Native modules used by the SDK are not available in Expo Go.

## Quick Start

### Generate A Screen Map

A screen map gives the assistant route names, screen descriptions, and navigation chains.

```bash
npx react-native-ai-agent generate-map
```

You can also auto-generate it during Metro startup:

```js
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

require('@mobileai/react-native/generate-map').autoGenerate(__dirname);

module.exports = getDefaultConfig(__dirname);
```

### React Navigation

```tsx
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { AIAgent } from '@mobileai/react-native';
import screenMap from './ai-screen-map.json';

export default function App() {
  const navRef = useNavigationContainerRef();

  return (
    <AIAgent
      analyticsKey="mobileai_pub_xxxxxxxx"
      navRef={navRef}
      screenMap={screenMap}
    >
      <NavigationContainer ref={navRef}>{/* your screens */}</NavigationContainer>
    </AIAgent>
  );
}
```

### Expo Router

```tsx
import { Slot, useNavigationContainerRef } from 'expo-router';
import { AIAgent } from '@mobileai/react-native';
import screenMap from '../ai-screen-map.json';

export default function RootLayout() {
  const navRef = useNavigationContainerRef();

  return (
    <AIAgent
      analyticsKey="mobileai_pub_xxxxxxxx"
      navRef={navRef}
      screenMap={screenMap}
    >
      <Slot />
    </AIAgent>
  );
}
```

### Provider Options

Use `analyticsKey` when you want MobileAI Cloud to handle the hosted AI proxy, knowledge base, analytics, and support escalation.

For local prototyping only, you can pass a provider API key directly:

```tsx
<AIAgent provider="gemini" apiKey="YOUR_DEV_ONLY_KEY" navRef={navRef}>
  {children}
</AIAgent>
```

For production without MobileAI Cloud, route requests through your backend:

```tsx
<AIAgent
  provider="openai"
  proxyUrl="https://api.example.com/mobileai/chat"
  proxyHeaders={{ Authorization: `Bearer ${sessionToken}` }}
  navRef={navRef}
>
  {children}
</AIAgent>
```

## Core Concepts

### Interaction Modes

| Mode | What it does |
| --- | --- |
| `companion` | Screen-aware guidance only. The assistant can explain what it sees and guide the user, but cannot control the UI. |
| `copilot` | Default. Performs approved app actions while the runtime enforces guardrails. |
| `autopilot` | Runs trusted automation flows with minimal interruption. Use only for low-risk workflows. |

Companion mode is useful when trust matters more than automation. The assistant can look at the current screen, answer questions, explain confusing states, suggest the safest next step, query knowledge or app data, and escalate to a human if configured. It cannot tap, type, scroll, navigate, submit forms, highlight elements, inject UI, or otherwise operate the app on the user's behalf.

```tsx
<AIAgent interactionMode="companion" analyticsKey="mobileai_pub_xxxxxxxx">
  {children}
</AIAgent>
```

### Screen Mapping

The runtime can inspect the current React tree at execution time. The generated `ai-screen-map.json` adds app-wide navigation knowledge so the assistant can understand screens the user is not currently viewing.

```tsx
<AIAgent screenMap={screenMap} useScreenMap>
  {children}
</AIAgent>
```

### App Data With `useData`

Use `useData` for information the assistant should fetch directly instead of guessing from the UI.

```tsx
import { useData } from '@mobileai/react-native';

function OrdersScreen() {
  useData(
    'orders',
    'Read the signed-in customer orders and delivery status',
    {
      orderId: 'Order identifier',
      status: 'Current delivery status',
      eta: 'Estimated arrival time',
    },
    async ({ query }) => searchOrders(query)
  );

  return null;
}
```

### App Actions With `useAction`

Use `useAction` for safe app-owned operations that are better executed through code than by tapping UI.

```tsx
import { useAction } from '@mobileai/react-native';

function CartScreen() {
  useAction(
    'apply_coupon',
    'Apply a coupon code to the current cart',
    {
      code: { type: 'string', description: 'Coupon code', required: true },
    },
    async ({ code }) => applyCoupon(String(code))
  );

  return null;
}
```

### Knowledge Base

Pass static entries, a retriever, or configure project knowledge in MobileAI Cloud.

```tsx
<AIAgent
  knowledgeBase={[
    {
      id: 'returns',
      title: 'Return policy',
      content: 'Customers can request returns within 30 days.',
    },
  ]}
>
  {children}
</AIAgent>
```

## Guardrails

Guardrails are enforced by the runtime, not by the assistant alone.

- Consent is required by default before app context is sent to an AI provider.
- Companion mode blocks UI-control tools.
- Copilot mode uses workflow approval for routine app actions.
- Semantic action safety classifies generic UI actions as `allow`, `ask`, or `block`.
- `aiConfirm` forces confirmation for specific controls.
- `aiIgnore` removes sensitive controls from the assistant's visible target list.
- `transformScreenContent` can mask sensitive text before provider calls.
- Every action can be traced with lifecycle callbacks and `actionSafety.onDecision`.

The SDK ships with default semantic guardrails in copilot mode. You can tune or replace them:

```tsx
<AIAgent
  interactionMode="copilot"
  actionSafety={{
    classifier: 'default',
    unknownActionDecision: 'ask',
    approvalReuse: 'risk-boundary',
    onDecision: (decision) => {
      console.log(decision.capability, decision.risk, decision.decision);
    },
  }}
>
  {children}
</AIAgent>
```

Read the full safety model in [docs/guardrails.md](./docs/guardrails.md).

## Common Recipes

### Support Assistant

```tsx
import { AIAgent, buildSupportPrompt } from '@mobileai/react-native';

<AIAgent
  analyticsKey="mobileai_pub_xxxxxxxx"
  instructions={{
    system: buildSupportPrompt({
      enabled: true,
      persona: { agentName: 'Nora', preset: 'warm-concise' },
      autoEscalateTopics: ['account deletion', 'legal request'],
    }),
  }}
  userContext={{ userId: user.id, email: user.email }}
  navRef={navRef}
>
  {children}
</AIAgent>;
```

### Companion Mode

Use companion mode when you want help without UI control. The assistant stays beside the user: it can read the screen, reason about what is visible, use knowledge and app data, and tell the user what to do next in plain language.

For example, if the user says "my latest order is late", companion mode should not just say "go to Orders." It can explain what matters: check the latest order, look for ETA or driver status, and use the order-specific Help option if the ETA has passed or tracking is stale.

```tsx
<AIAgent
  interactionMode="companion"
  analyticsKey="mobileai_pub_xxxxxxxx"
  navRef={navRef}
>
  {children}
</AIAgent>
```

### Human Escalation

With `analyticsKey`, the SDK can create MobileAI support tickets and stream human replies back into the assistant UI.

```tsx
<AIAgent
  analyticsKey="mobileai_pub_xxxxxxxx"
  userContext={{
    userId: user.id,
    name: user.name,
    email: user.email,
    plan: user.plan,
  }}
  pushToken={expoPushToken}
  pushTokenType="expo"
>
  {children}
</AIAgent>
```

### Custom Chat UI

Hide the built-in chat bar and drive the assistant from your own UI.

```tsx
import { AIAgent, useAI } from '@mobileai/react-native';

function CustomAssistantInput() {
  const { send, isLoading, status, messages, cancel } = useAI();

  return null;
}

<AIAgent showChatBar={false} analyticsKey="mobileai_pub_xxxxxxxx">
  <CustomAssistantInput />
  {children}
</AIAgent>;
```

## More Docs

- [Guardrails](./docs/guardrails.md): approval flow, semantic safety, masking, overrides, and tracing.
- [API reference](./docs/api-reference.md): props, hooks, types, and configuration tables.
- [Rich UI](./docs/rich-ui.md): structured blocks, `RichContentRenderer`, `AIZone`, themes, and block handlers.
- [Production](./docs/production.md): proxy setup, support tickets, analytics, consent, and security notes.
- [Wireframe capture](./docs/wireframe-capture.md): visual telemetry snapshots.
- [MCP bridge](./mcp-server/README.md): connect local or remote Model Context Protocol tools.
- [AI emulator testing](./example-ai-testing/README.md): test app flows through an AI-driven emulator harness.

## Requirements

- React Native `>=0.83.0 <0.84.0`
- React 19 compatible app setup
- iOS or Android native build
- Expo development build or prebuild when using Expo
- `react-native-screens` for navigation-heavy apps
- Optional voice dependencies: `react-native-audio-api`, `expo-speech-recognition`
- Optional consent persistence: `@react-native-async-storage/async-storage`

## Troubleshooting

**The assistant cannot navigate.** Pass `navRef`, generate a screen map, and make sure route names in the map match your navigation setup.

**The assistant does not see a control.** Add an `accessibilityLabel`, make sure the element is mounted, and avoid wrapping important controls in components that hide host props.

**A sensitive control is visible to the assistant.** Add `aiIgnore` or mask it with `transformScreenContent`.

**The runtime asks more than expected.** Check `actionSafety.onDecision` logs. Low confidence, unknown capability, changed scope, and high-impact risk boundaries intentionally ask instead of silently acting.

**Voice mode does not start.** Confirm native permissions and install the optional voice dependencies in a native build.

## License

See [LICENSE](./LICENSE).
