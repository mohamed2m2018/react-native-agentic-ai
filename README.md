# Agentic AI for React Native

> **Add an autonomous AI agent to any React Native app — no rewrite needed.** Wrap your app with `<AIAgent>` and get: natural language UI control, real-time voice conversations, and a built-in knowledge base. Fully customizable, production-grade security, performant, and lightweight. Plus: an MCP bridge that lets any AI connect to and test your app.

**Two names, one package — pick whichever you prefer:**

```bash
npm install @mobileai/react-native
# — or —
npm install react-native-agentic-ai
```

### 🤖 AI Agent — Autonomous UI Control

<p align="center">
  <img src="./assets/demo.gif" alt="AI Agent autonomously controlling a React Native app UI via natural language" width="350" />
</p>

### 🧪 AI-Powered Testing — Test Your App in English, Not Code

<p align="center">
  <img src="./assets/mcp-testing.gif" alt="AI-Powered Testing via Model Context Protocol — finding bugs in React Native app without test code" width="700" />
</p>

> *Google Antigravity running 5 checks on the emulator and finding 5 real bugs — zero test code, zero selectors, just English.*

---

[![npm](https://img.shields.io/npm/v/@mobileai/react-native?label=%40mobileai%2Freact-native)](https://www.npmjs.com/package/@mobileai/react-native)

[![npm](https://img.shields.io/npm/v/react-native-agentic-ai?label=react-native-agentic-ai)](https://www.npmjs.com/package/react-native-agentic-ai)

[![license](https://img.shields.io/npm/l/@mobileai/react-native)](https://github.com/mohamed2m2018/mobileai-react-native/blob/main/LICENSE)

[![platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-brightgreen)]()

**Two names, one package** — install either: `@mobileai/react-native` or `react-native-agentic-ai`

> ⭐ If this helped you, [star this repo](https://github.com/mohamed2m2018/react-native-agentic-ai) — it helps others find it!

---

## 🧠 How It Works — Structure-First Agentic AI

What if your AI could understand your app the way a real user does — not by looking at pixels, but by reading the actual UI structure?

That's what this SDK does. It reads your app's live UI natively — every button, label, input, and screen — in real time. The AI understands your app's structure, not a screenshot of it.

**No OCR. No image pipelines. No selectors. No annotations. No view wrappers.**

The result: an AI that truly understands your app — and can act on it autonomously.

| | This SDK | Screenshot-based AI | Build It Yourself |
|---|---|---|---|
| **Setup** | `<AIAgent>` — one wrapper | Vision model + custom pipeline | Months of custom code |
| **How it reads UI** | Native structure — real time | Screenshot → OCR | Custom integration |
| **AI agent loop** | ✅ Built-in multi-step | ❌ Build from scratch | ❌ Build from scratch |
| **Voice mode** | ✅ Real-time bidirectional | ❌ | ❌ |
| **Custom business logic** | ✅ `useAction` hook | Custom code | Custom code |
| **MCP bridge (any AI connects)** | ✅ One command | ❌ | ❌ |
| **Knowledge base** | ✅ Built-in retrieval | ❌ | ❌ |

---

## ✨ What's Inside

### Ship to Production

#### 🤖 Autonomous AI Agent — Natural Language UI Automation

Your users describe what they want in natural language. The SDK reads the live screen, plans a sequence of actions, and executes them end-to-end — tapping buttons, filling forms, navigating screens — all autonomously. Powered by **Gemini**. **OpenAI** is also supported as a text mode alternative.

- **Zero-config** — wrap your app with `<AIAgent>`, done. No annotations, no selectors
- **Multi-step reasoning** — navigates across screens to complete complex tasks
- **Custom actions** — expose any business logic (checkout, API calls, mutations) via `useAction`
- **Knowledge base** — AI queries your FAQs, policies, product data on demand
- **Human-in-the-loop** — native `Alert.alert` confirmation before critical actions

#### 🎤 Real-time Voice AI Agent — Bidirectional Audio with Gemini Live API

Full bidirectional voice AI powered by the Gemini Live API (Gemini only). Users speak naturally; the agent responds with voice AND controls your app simultaneously.

- **Sub-second latency** — real-time audio via WebSockets, not turn-based
- **Full UI control** — same tap, type, navigate, custom actions as text mode — all by voice
- **Screen-aware** — auto-detects screen changes and updates its context instantly

> 💡 **Speech-to-text in text mode:** Install `expo-speech-recognition` and a mic button appears in the chat bar — letting users dictate messages instead of typing. This is separate from voice mode.

---

### Supercharge Your Dev Workflow

#### 🔌 MCP Bridge — Connect Any AI to Your App

Your app becomes MCP-compatible with one prop. Any AI that speaks the Model Context Protocol — editors, autonomous agents, CI/CD pipelines, custom scripts — can remotely read and control your app.

The MCP bridge uses the **same `AgentRuntime`** that powers the in-app AI agent. If the agent can do it via chat, an external AI can do it via MCP.

**MCP-only mode** — just want testing? No chat popup needed:
```tsx
<AIAgent
  showChatBar={false}
  mcpServerUrl="ws://localhost:3101"
  apiKey="YOUR_KEY"
  navRef={navRef}
>
  <App />
</AIAgent>
```

#### 🧪 AI-Powered Testing via MCP

The most powerful use case: test your app without writing test code. Connect your AI (Antigravity, Claude Desktop, or any MCP client) to the emulator and describe what to check — in English. No selectors to maintain, no flaky tests, self-healing by design.

**Skip the test framework. Just ask:**

**Ad-hoc** — ask your AI anything about the running app:
> *"Is the Laptop Stand price consistent between the home screen and the product detail page?"*

**YAML Test Plans** — commit reusable checks to your repo:
```yaml
# tests/smoke.yaml
checks:
  - id: price-sync
    check: "Read the Laptop Stand price on home, tap it, compare with detail page"
  - id: profile-email
    check: "Go to Profile tab. Is the email displayed under the user's name?"
```
Then tell your AI: *"Read tests/smoke.yaml and run each check on the emulator"*

**Real Results — 5 bugs found autonomously:**

| # | What was checked | Bug found | AI steps |
|---|---|---|---|
| 1 | Price consistency (list → detail) | Laptop Stand: **$45.99** vs **$49.99** | 2 |
| 2 | Profile completeness | **Email missing** — only name shown | 2 |
| 3 | Settings navigation | **Help Center missing** from Support section | 2 |
| 4 | Description vs specifications | "breathable mesh" vs **"Leather Upper"** | 3 |
| 5 | Cross-screen price sync | Yoga Mat: **$39.99** vs **$34.99** | 4 |

---

## 📦 Installation

**Two names, one package — pick whichever you prefer:**

```bash
npm install @mobileai/react-native
# — or —
npm install react-native-agentic-ai
```

No native modules required by default. Works with **Expo managed workflow** out of the box — no eject needed.

### Optional Dependencies

<details>
<summary><b>📸 Screenshots</b> — for image/video content understanding</summary>

```bash
npx expo install react-native-view-shot
```

</details>

<details>
<summary><b>🎙️ Speech-to-Text in Text Mode</b> — dictate messages instead of typing</summary>

```bash
npx expo install expo-speech-recognition
```

Automatically detected. No extra config needed — a mic icon appears in the text chat bar, letting users speak their message instead of typing. This is separate from voice mode.

</details>

<details>
<summary><b>🎤 Voice Mode</b> — real-time bidirectional voice agent</summary>

```bash
npm install react-native-audio-api
```

**Expo Managed** — add to `app.json`:
```json
{
  "expo": {
    "android": { "permissions": ["RECORD_AUDIO", "MODIFY_AUDIO_SETTINGS"] },
    "ios": { "infoPlist": { "NSMicrophoneUsageDescription": "Required for voice chat with AI assistant" } }
  }
}
```
Then rebuild: `npx expo prebuild && npx expo run:android` (or `run:ios`)

**Expo Bare / React Native CLI** — add `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` to `AndroidManifest.xml` and `NSMicrophoneUsageDescription` to `Info.plist`, then rebuild.

> Hardware echo cancellation (AEC) is automatically enabled — no extra setup.

</details>

---

## 🚀 Quick Start

### 1. Enable Screen Mapping (optional, recommended)

Add one line to your `metro.config.js` — the AI gets a map of every screen in your app, auto-generated on each dev start:

```js
// metro.config.js
require('@mobileai/react-native/generate-map').autoGenerate(__dirname);
```

Or generate it manually anytime:

```bash
npx @mobileai/react-native generate-map
```

> Without this, the AI can only see the currently mounted screen — it has no idea what other screens exist or how to reach them. Example: *"Write a review for the Laptop Stand"* — the AI sees the Home screen but doesn't know a `WriteReview` screen exists 3 levels deep. With a map, it sees every screen in your app and knows exactly how to get there: `Home → Products → Detail → Reviews → WriteReview`.

### 2. Wrap Your App

#### React Navigation

```tsx
import { AIAgent } from '@mobileai/react-native'; // or 'react-native-agentic-ai'
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import screenMap from './ai-screen-map.json'; // auto-generated by step 1

export default function App() {
  const navRef = useNavigationContainerRef();

  return (
    <AIAgent
      // ⚠️ Prototyping ONLY — don't ship API keys in production
      apiKey="YOUR_API_KEY"

      // ✅ Production: route through your secure backend proxy
      // proxyUrl="https://api.yourdomain.com/ai-proxy"
      // proxyHeaders={{ Authorization: `Bearer ${userToken}` }}

      navRef={navRef}
      screenMap={screenMap} // optional but recommended
    >
      <NavigationContainer ref={navRef}>
        {/* Your existing screens — zero changes needed */}
      </NavigationContainer>
    </AIAgent>
  );
}
```

#### Expo Router

In your root layout (`app/_layout.tsx`):

```tsx
import { AIAgent } from '@mobileai/react-native'; // or 'react-native-agentic-ai'
import { Slot, useNavigationContainerRef } from 'expo-router';
import screenMap from './ai-screen-map.json'; // auto-generated by step 1

export default function RootLayout() {
  const navRef = useNavigationContainerRef();

  return (
    <AIAgent
      apiKey={process.env.AI_API_KEY!}
      navRef={navRef}
      screenMap={screenMap}
    >
      <Slot />
    </AIAgent>
  );
}
```

### Choose Your Provider

The examples above use **Gemini** (default). To use **OpenAI** for text mode, add the `provider` prop. Voice mode is not supported with OpenAI.

```tsx
<AIAgent
  provider="openai"
  apiKey="YOUR_OPENAI_API_KEY"
  // model="gpt-4.1-mini"  ← default, or use any OpenAI model
  navRef={navRef}
>
  {/* Same app, different brain */}
</AIAgent>
```

A floating chat bar appears automatically. Ask the AI to navigate, tap buttons, fill forms, answer questions.

### Knowledge-Only Mode — AI Assistant Without UI Automation

Set `enableUIControl={false}` for a lightweight FAQ / support assistant. Single LLM call, ~70% fewer tokens:

```tsx
<AIAgent enableUIControl={false} knowledgeBase={KNOWLEDGE} />
```

| | Full Agent (default) | Knowledge-Only |
|---|---|---|
| UI analysis | ✅ Full structure read | ❌ Skipped |
| Tokens per request | ~500-2000 | ~200 |
| Agent loop | Up to 25 steps | Single call |
| Tools available | 7 | 2 (done, query_knowledge) |

---

## 🗺️ Screen Mapping — Navigation Intelligence

By default, the AI navigates by reading what's on screen and tapping visible elements. **Screen mapping** gives the AI a complete map of every screen and how they connect — via static analysis of your source code (AST). No API key needed, runs in ~2 seconds.

### Setup (one line)

Add to your `metro.config.js` — the screen map auto-generates every time Metro starts:

```js
// metro.config.js
require('@mobileai/react-native/generate-map').autoGenerate(__dirname);

// ... rest of your Metro config
```

Then pass the generated map to `<AIAgent>`:

```tsx
import screenMap from './ai-screen-map.json';

<AIAgent screenMap={screenMap} navRef={navRef}>
  <App />
</AIAgent>
```

That's it. Works with both **Expo Router** and **React Navigation** — auto-detected.

### What It Gives the AI

| Without Screen Map | With Screen Map |
|---|---|
| AI sees only the current screen | AI knows every screen in your app |
| Must explore to find features | Plans the full navigation path upfront |
| Deep screens may be unreachable | Knows each screen's `navigatesTo` links |
| No knowledge of dynamic routes | Understands `item/[id]`, `category/[id]` patterns |

### Disable Without Removing

```tsx
<AIAgent screenMap={screenMap} useScreenMap={false} />
```

<details>
<summary><b>Advanced: Watch mode, CLI options, and npm scripts</b></summary>

**Manual generation:**

```bash
npx @mobileai/react-native generate-map
```

**Watch mode** — auto-regenerates on file changes:

```bash
npx @mobileai/react-native generate-map --watch
```

**npm scripts** — auto-run before start/build:

```json
{
  "scripts": {
    "generate-map": "npx @mobileai/react-native generate-map",
    "prestart": "npm run generate-map",
    "prebuild": "npm run generate-map"
  }
}
```

| Flag | Description |
|------|-------------|
| `--watch`, `-w` | Watch for file changes and auto-regenerate |
| `--dir=./path` | Custom project directory |

</details>

> 💡 The generated `ai-screen-map.json` is committed to your repo — no runtime cost.

---

## 🧠 Knowledge Base

Give the AI domain knowledge it can query on demand — policies, FAQs, product details. Uses a `query_knowledge` tool to fetch only relevant entries (no token waste).

### Static Array

```tsx
import type { KnowledgeEntry } from '@mobileai/react-native'; // or 'react-native-agentic-ai'

const KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'shipping',
    title: 'Shipping Policy',
    content: 'Free shipping on orders over $75. Standard: 5-7 days. Express: 2-3 days.',
    tags: ['shipping', 'delivery'],
  },
  {
    id: 'returns',
    title: 'Return Policy',
    content: '30-day returns on all items. Refunds in 5-7 business days.',
    tags: ['return', 'refund'],
    screens: ['product/[id]', 'order-history'], // only surface on these screens
  },
];

<AIAgent knowledgeBase={KNOWLEDGE} />
```

### Custom Retriever — Bring Your Own Search

```tsx
<AIAgent
  knowledgeBase={{
    retrieve: async (query: string, screenName?: string) => {
      const results = await fetch(`/api/knowledge?q=${query}&screen=${screenName}`);
      return results.json();
    },
  }}
/>
```

---

## 🔌 MCP Bridge Setup — Connect AI Editors to Your App

### Architecture

```
┌──────────────────┐                  ┌──────────────────┐    WebSocket     ┌──────────────────┐
│  Antigravity     │  Streamable HTTP │                  │                 │                  │
│  Claude Desktop  │ ◄──────────────► │ @mobileai/       │ ◄─────────────► │  Your React      │
│  or any MCP      │    (port 3100)   │  mcp-server      │   (port 3101)   │  Native App      │
│  compatible AI   │  + Legacy SSE    │                  │                 │                  │
└──────────────────┘                  └──────────────────┘                 └──────────────────┘
```

### Setup in 3 Steps

**1. Start the MCP bridge** — no install needed:

```bash
npx @mobileai/mcp-server
```

**2. Connect your React Native app:**

```tsx
<AIAgent
  apiKey="YOUR_API_KEY"
  mcpServerUrl="ws://localhost:3101"
/>
```

**3. Connect your AI:**

<details>
<summary><b>Google Antigravity</b></summary>

Add to `~/.gemini/antigravity/mcp_config.json`:

```json
{
  "mcpServers": {
    "mobile-app": {
      "command": "npx",
      "args": ["@mobileai/mcp-server"]
    }
  }
}
```

Click **Refresh** in MCP Store. You'll see `mobile-app` with 2 tools: `execute_task` and `get_app_status`.

</details>

<details>
<summary><b>Claude Desktop</b></summary>

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mobile-app": {
      "url": "http://localhost:3100/mcp/sse"
    }
  }
}
```

</details>

<details>
<summary><b>Other MCP Clients</b></summary>

- **Streamable HTTP**: `http://localhost:3100/mcp`
- **Legacy SSE**: `http://localhost:3100/mcp/sse`

</details>

### MCP Tools

| Tool | Description |
|------|-------------|
| `execute_task(command)` | Send a natural language command to the app |
| `get_app_status()` | Check if the React Native app is connected |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_PORT` | `3100` | HTTP port for MCP clients |
| `WS_PORT` | `3101` | WebSocket port for the React Native app |

---

## 🔌 API Reference

### `<AIAgent>` Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `apiKey` | `string` | — | API key for your provider (prototyping only). |
| `provider` | `'gemini' \| 'openai'` | `'gemini'` | LLM provider for text mode. |
| `proxyUrl` | `string` | — | Backend proxy URL (production). |
| `proxyHeaders` | `Record<string, string>` | — | Auth headers for proxy. |
| `voiceProxyUrl` | `string` | — | Dedicated proxy for Voice Mode WebSockets. |
| `voiceProxyHeaders` | `Record<string, string>` | — | Auth headers for voice proxy. |
| `model` | `string` | Provider default | Model name (e.g. `gemini-2.5-flash`, `gpt-4.1-mini`). |
| `navRef` | `NavigationContainerRef` | — | Navigation ref for auto-navigation. |
| `maxSteps` | `number` | `25` | Max agent steps per task. |
| `maxTokenBudget` | `number` | — | Max total tokens before auto-stopping the agent loop. |
| `maxCostUSD` | `number` | — | Max estimated cost (USD) before auto-stopping. |
| `showChatBar` | `boolean` | `true` | Show the floating chat bar. |
| `enableVoice` | `boolean` | `true` | Enable voice mode tab. |
| `enableUIControl` | `boolean` | `true` | When `false`, AI becomes knowledge-only. |
| `screenMap` | `ScreenMap` | — | Pre-generated screen map from `generate-map` CLI. |
| `useScreenMap` | `boolean` | `true` | Set `false` to disable screen map without removing the prop. |
| `instructions` | `{ system?, getScreenInstructions? }` | — | Custom system prompt + per-screen instructions. |
| `customTools` | `Record<string, ToolDefinition \| null>` | — | Override or remove built-in tools. |
| `knowledgeBase` | `KnowledgeEntry[] \| KnowledgeRetriever` | — | Domain knowledge the AI can query. |
| `knowledgeMaxTokens` | `number` | `2000` | Max tokens for knowledge results. |
| `mcpServerUrl` | `string` | — | WebSocket URL for MCP bridge. |
| `accentColor` | `string` | — | Accent color for the chat bar. |
| `theme` | `ChatBarTheme` | — | Full chat bar color customization. |
| `onResult` | `(result) => void` | — | Called when agent finishes. |
| `onBeforeStep` | `(stepCount) => void` | — | Called before each step. |
| `onAfterStep` | `(history) => void` | — | Called after each step. |
| `onTokenUsage` | `(usage) => void` | — | Token usage per step. |
| `onAskUser` | `(question) => Promise<string>` | — | Handle `ask_user` inline — agent waits for your response. |
| `stepDelay` | `number` | — | Delay between steps (ms). |
| `router` | `{ push, replace, back }` | — | Expo Router instance. |
| `pathname` | `string` | — | Current pathname (Expo Router). |
| `debug` | `boolean` | `false` | Enable SDK debug logging. |
| `analyticsKey` | `string` | — | Publishable key (`mobileai_pub_xxx`) for zero-config analytics to MobileAI Cloud. |
| `analyticsProxyUrl` | `string` | — | Enterprise: route analytics events through your backend proxy. |
| `analyticsProxyHeaders` | `Record<string, string>` | — | Auth headers for analyticsProxyUrl. |

### 🎨 Customization

```tsx
// Quick — one color:
<AIAgent accentColor="#6C5CE7" />

// Full theme:
<AIAgent
  accentColor="#6C5CE7"
  theme={{
    backgroundColor: 'rgba(44, 30, 104, 0.95)',
    inputBackgroundColor: 'rgba(255, 255, 255, 0.12)',
    textColor: '#ffffff',
    successColor: 'rgba(40, 167, 69, 0.3)',
    errorColor: 'rgba(220, 53, 69, 0.3)',
  }}
/>
```

### `useAction` — Custom AI-Callable Business Logic

Register isolated, headless logic for the AI to call (e.g., API requests, checkouts).
The handler is kept automatically fresh internally, so you never get stuck with a stale closure. The optional `deps` array re-registers the action so the AI sees an updated description.

```tsx
import { useAction } from '@mobileai/react-native'; // or 'react-native-agentic-ai'

function CartScreen() {
  const { cart, clearCart, getTotal } = useCart();

  // Passing [cart.length] ensures the AI receives the live item count in its context!
  useAction(
    'checkout',
    `Place the order and checkout (${cart.length} items for $${getTotal()})`,
    {},
    async () => {
      if (cart.length === 0) return { success: false, message: 'Cart is empty' };

      // Human-in-the-loop: AI pauses until user taps Confirm
      return new Promise((resolve) => {
        Alert.alert('Confirm Order', `Place order for $${getTotal()}?`, [
          { text: 'Cancel', onPress: () => resolve({ success: false, message: 'User denied.' }) },
          { text: 'Confirm', onPress: () => { clearCart(); resolve({ success: true, message: `Order placed!` }); } },
        ]);
      });
    },
    [cart.length, getTotal]
  );
}
```

### `useAI` — Headless / Custom Chat UI

```tsx
import { useAI } from '@mobileai/react-native'; // or 'react-native-agentic-ai'

function CustomChat() {
  const { send, isLoading, status, messages } = useAI();

  return (
    <View style={{ flex: 1 }}>
      <FlatList data={messages} renderItem={({ item }) => <Text>{item.content}</Text>} />
      {isLoading && <Text>{status}</Text>}
      <TextInput onSubmitEditing={(e) => send(e.nativeEvent.text)} placeholder="Ask the AI..." />
    </View>
  );
}
```

Chat history persists across navigation. Override settings per-screen:

```tsx
const { send } = useAI({
  enableUIControl: false,
  onResult: (result) => router.push('/(tabs)/chat'),
});
```

---

## 📊 Zero-Config Analytics — Auto-Capture Every Tap

Just add `analyticsKey` — every button tap, screen navigation, and session is tracked automatically. **Zero code changes** to your app components.

```tsx
<AIAgent
  apiKey="YOUR_KEY"
  analyticsKey="mobileai_pub_abc123"   // ← enables full auto-capture
  navRef={navRef}
>
  <App />
</AIAgent>
```

**What's captured automatically:**

| Event | Data | How |
|-------|------|-----|
| `user_interaction` | Button label, screen, coordinates, `actor: 'user'` | Root touch interceptor |
| `screen_view` | Screen name, previous screen | Navigation ref listener |
| `session_start` | Device, OS, SDK version | On mount |
| `session_end` | Duration, event count | On background |
| `agent_request` | User query | On AI task start |
| `agent_step` | Tool name, args, result | On each AI action |
| `agent_complete` | Success, steps, cost | On AI task end |

### AI vs User Action Differentiation

When the AI agent taps a button on behalf of the user, those taps are **not** counted as `user_interaction` events — they're already captured as `agent_step` events with full context.

This means your funnels and retention charts always show **real human behaviour**, while the AI's actions are separately attributed for ROI analysis. No other analytics SDK can offer this because they don't own the app root.

| Event | Who | Dashboard use |
|-------|-----|--------------|
| `user_interaction { actor: 'user' }` | Human only | Funnels, retention, journeys |
| `agent_step { tool: 'tap' }` | AI only | Agent ROI, resolution rate |

**Custom business events** — track what matters to you:

```tsx
import { MobileAI } from '@mobileai/react-native';

MobileAI.track('purchase_complete', { order_id: 'ord_1', total: 29.99 });
MobileAI.identify('user_123', { plan: 'pro' });
```

> Enterprise: use `analyticsProxyUrl` to route events through your own backend — zero keys in the app bundle.

---

## 🔒 Security & Production

### Backend Proxy — Keep API Keys Secure

```tsx
<AIAgent
  proxyUrl="https://myapp.vercel.app/api/gemini"
  proxyHeaders={{ Authorization: `Bearer ${userToken}` }}
  voiceProxyUrl="https://voice-server.render.com"  // only if text proxy is serverless
  navRef={navRef}
>
```

> `voiceProxyUrl` falls back to `proxyUrl` if not set. Only needed when your text API is on a serverless platform that can't hold WebSocket connections.

<details>
<summary><b>Next.js Text Proxy Example</b></summary>

```typescript
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  const response = await fetch('https://generativelanguage.googleapis.com/...', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await response.json());
}
```

</details>

<details>
<summary><b>Express WebSocket Proxy (Voice Mode)</b></summary>

```javascript
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const geminiProxy = createProxyMiddleware({
  target: 'https://generativelanguage.googleapis.com',
  changeOrigin: true,
  ws: true,
  pathRewrite: (path) => `${path}${path.includes('?') ? '&' : '?'}key=${process.env.GEMINI_API_KEY}`,
});

app.use('/v1beta/models', geminiProxy);
const server = app.listen(3000);
server.on('upgrade', geminiProxy.upgrade);
```

</details>

### Element Gating — Hide Elements from AI

```tsx
<Pressable aiIgnore={true}><Text>Admin Panel</Text></Pressable>
```

### Content Masking — Sanitize Before LLM Sees It

```tsx
<AIAgent transformScreenContent={(c) => c.replace(/\b\d{13,16}\b/g, '****-****-****-****')} />
```

### Screen-Specific Instructions

```tsx
<AIAgent instructions={{
  system: 'You are a food delivery assistant.',
  getScreenInstructions: (screen) => screen === 'Cart' ? 'Confirm total before checkout.' : undefined,
}} />
```

### Lifecycle Hooks

| Hook | When |
|------|------|
| `onBeforeStep` | Before each agent step |
| `onAfterStep` | After each step (with full history) |
| `onBeforeTask` | Before task execution |
| `onAfterTask` | After task completes |

---

## 🛠️ Built-in Tools

| Tool | What it does |
|------|-------------|
| `tap(index)` | Tap any interactive element — buttons, switches, checkboxes, custom components |
| `long_press(index)` | Long-press an element to trigger context menus |
| `type(index, text)` | Type into a text input |
| `scroll(direction, amount?)` | Scroll content — auto-detects edge, rejects PagerView |
| `slider(index, value)` | Drag a slider to a specific value |
| `picker(index, value)` | Select a value from a dropdown/picker |
| `date_picker(index, date)` | Set a date on a date picker |
| `navigate(screen)` | Navigate to any screen |
| `wait(seconds)` | Wait for loading states before acting |
| `capture_screenshot(reason)` | Capture the screen as an image (requires `react-native-view-shot`) |
| `done(text)` | Finish the task with a response |
| `ask_user(question)` | Ask the user for clarification |
| `query_knowledge(question)` | Search the knowledge base |

---

## 📋 Requirements

- React Native 0.72+
- Expo SDK 49+ (or bare React Native)
- **Gemini** API key — [Get one free](https://aistudio.google.com/apikey), or
- **OpenAI** API key — [Get one](https://platform.openai.com/api-keys)

> **Gemini** is the default provider and powers all modes (text + voice). **OpenAI** is available as a text mode alternative via `provider="openai"`. Voice mode uses `gemini-2.5-flash-native-audio-preview` (Gemini only).

## 📄 License

MIT © [Mohamed Salah](https://github.com/mohamed2m2018)

👋 Let's connect — [LinkedIn](https://www.linkedin.com/in/muhammad-salah-eldin/)
