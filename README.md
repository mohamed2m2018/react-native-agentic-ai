# MobileAI — React Native AI Agent

> **Autonomous AI agent for React Native** — Your app gets an AI copilot that can see, understand, and interact with your UI. Zero wrappers, zero view rewriting.

> If this helped you, consider giving it a ⭐ on [GitHub](https://github.com/mohamed2m2018/react-native-agentic-ai) — it helps others find this project!

<p align="center">
  <img src="./assets/demo.gif" alt="MobileAI Demo" width="350" />
</p>

**Two names, one package — install either:**

| | Package | npm |
|---|---|---|
| 📦 | `@mobileai/react-native` | [![npm](https://img.shields.io/npm/v/@mobileai/react-native?label=latest)](https://www.npmjs.com/package/@mobileai/react-native) |
| 📦 | `react-native-agentic-ai` | [![npm](https://img.shields.io/npm/v/react-native-agentic-ai?label=latest)](https://www.npmjs.com/package/react-native-agentic-ai) |

[![license](https://img.shields.io/npm/l/@mobileai/react-native)](https://github.com/mohamed2m2018/mobileai-react-native/blob/main/LICENSE)
[![platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-brightgreen)]()

Wrap your navigation with `<AIAgent>`. The AI automatically understands your entire screen — every button, every input, every label — and acts on it.

## ✨ Features

### Text Mode
- 🤖 **Zero-config UI understanding** — No annotations needed. The AI sees and understands your entire screen automatically.
- 🎯 **Works with every component** — Buttons, switches, inputs, custom components — all work out of the box.
- 🖼️ **Sees images & videos** — The AI knows what media is on screen and can describe it.
- 🧭 **Auto-navigation** — Navigates between screens to complete multi-step tasks.
- 🧩 **Custom actions** — Expose any business logic (checkout, API calls) as AI-callable tools with `useAction`.
- 🌐 **MCP bridge** — Let external AI agents (OpenClaw, Claude Desktop) control your app remotely.
- 🌍 **Bilingual** — English and Arabic support built-in.

### 🎤 Voice Mode (Live Agent)
- 🗣️ **Real-time voice chat** — Bidirectional audio with Gemini Live API. Speak naturally, the agent responds with voice.
- 🔄 **Screen change detection** — The agent automatically detects when the screen changes (e.g., loading finishes) and updates its context — no polling tool needed.
- 🚫 **Auto-navigation guard** — Code-level gate rejects tool calls before the user speaks, preventing the model from acting on screen context alone.

### Security & Production
- 🔒 **Production-grade security** — Element gating, content masking, lifecycle hooks, human-in-the-loop confirmation.

> **Provider support:** Currently supports **Google Gemini** only (`gemini-2.5-flash` for text, `gemini-2.5-flash-native-audio-preview` for voice). Additional providers may be added in future releases.

## 📦 Installation

```bash
npm install @mobileai/react-native
# — or —
npm install react-native-agentic-ai
```

No native modules required by default. Works with Expo managed workflow out of the box — **no eject needed**.

### Optional Native Dependencies

#### Screenshots

If you want to use **Screenshots** (for image/video content), install this optional peer dependency:

```bash
npx expo install react-native-view-shot
```

#### 🎤 Voice Mode (Real-time Voice Chat)

Voice mode enables real-time bidirectional audio with the Gemini Live API. It requires one native module:

```bash
# Audio capture + playback (required for voice mode):
npm install react-native-audio-api
```

**After installing, you need native configuration based on your setup:**

<details>
<summary><b>Expo Managed Workflow</b></summary>

Add permissions to your `app.json`:

```json
{
  "expo": {
    "android": {
      "permissions": [
        "RECORD_AUDIO",
        "MODIFY_AUDIO_SETTINGS"
      ]
    },
    "ios": {
      "infoPlist": {
        "NSMicrophoneUsageDescription": "Required for voice chat with AI assistant"
      }
    }
  }
}
```

Then rebuild: `npx expo prebuild && npx expo run:android` (or `run:ios`)

</details>

<details>
<summary><b>Expo Bare / React Native CLI</b></summary>

**Android** — add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
```

**iOS** — add to `ios/YourApp/Info.plist`:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Required for voice chat with AI assistant</string>
```

Then rebuild: `npx react-native run-android` (or `run-ios`)

</details>

> **Note:** Hardware echo cancellation (AEC) is automatically enabled through `react-native-audio-api`'s AudioManager — no extra setup needed.

## 🚀 Quick Start

```tsx
import { AIAgent } from '@mobileai/react-native';
// or: import { AIAgent } from 'react-native-agentic-ai';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';

export default function App() {
  const navRef = useNavigationContainerRef();

  return (
    <AIAgent apiKey="YOUR_GEMINI_API_KEY" navRef={navRef}>
      <NavigationContainer ref={navRef}>
        {/* Your existing screens — zero changes needed */}
      </NavigationContainer>
    </AIAgent>
  );
}
```

A floating chat bar appears automatically. Ask the AI to navigate, tap buttons, fill forms — it reads your live UI and acts.

## 🔌 API Reference

### `<AIAgent>` Component

The root provider. Wrap your app once at the top level.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `apiKey` | `string` | — | **Required.** Gemini API key. |
| `model` | `string` | `'gemini-2.5-flash'` | Gemini model name for text mode. |
| `navRef` | `NavigationContainerRef` | — | Navigation ref for auto-navigation. |
| `maxSteps` | `number` | `10` | Max steps per task (text mode). |
| `showChatBar` | `boolean` | `true` | Show the floating chat bar. |
| `enableVoice` | `boolean` | `true` | Enable voice mode tab in the chat bar. |
| `language` | `'en' \| 'ar'` | `'en'` | Agent language (English/Arabic). |
| `onResult` | `(result) => void` | — | Called when the agent finishes. |

### `useAction(name, description, params, handler)`

Register a **non-UI action** the AI can call — for business logic that isn't a visible button.

```tsx
import { useAction } from '@mobileai/react-native';
// or: import { useAction } from 'react-native-agentic-ai';

function CartScreen() {
  const { cart, clearCart, getTotal } = useCart();

  // 'checkout' = tool name the AI calls, description = how the AI decides when to use it
  useAction('checkout', 'Place the order and checkout', {}, async () => {
    // Guard: return early with a failure message so the AI knows why
    if (cart.length === 0) {
      return { success: false, message: 'Cart is empty' };
    }
    const total = getTotal();

    // Human-in-the-loop: the AI's execution pauses here until the user taps Confirm/Cancel.
    // This is how you prevent the AI from performing critical actions without explicit approval.
    return new Promise((resolve) => {
      Alert.alert(
        'Confirm Order by AI',
        `Do you want the AI to place your order for $${total}?`,
        [
          { text: 'Cancel', style: 'cancel',
            onPress: () => resolve({ success: false, message: 'User denied the checkout.' }) },
          { text: 'Confirm', style: 'default',
            onPress: () => {
              clearCart();
              // Return success: true so the AI knows the action completed
              resolve({ success: true, message: `Order placed! Total: $${total}` });
            }
          },
        ]
      );
    });
  });
}
```

| Param | Type | Description |
|-------|------|-------------|
| `name` | `string` | Unique action name. |
| `description` | `string` | Natural language description for the AI. |
| `parameters` | `Record<string, string>` | Parameter schema (e.g., `{ itemName: 'string' }`). |
| `handler` | `(args) => any` | Execution handler. Can be sync or async. |

## 🔒 Security

### Element Gating

Hide specific elements from the AI:

```tsx
// Per-element: add aiIgnore prop
<Pressable aiIgnore={true} onPress={handleAdmin}>
  <Text>Admin Panel</Text>
</Pressable>

// Per-ref: blacklist by reference
const secretRef = useRef(null);
<AIAgent interactiveBlacklist={[secretRef]}>
  <Pressable ref={secretRef}>Hidden from AI</Pressable>
</AIAgent>
```

### Content Masking

Sanitize sensitive data before the LLM sees it:

```tsx
<AIAgent
  transformScreenContent={(content) =>
    content.replace(/\b\d{13,16}\b/g, '****-****-****-****')
  }
/>
```

### Screen-Specific Instructions

Guide the AI's behavior on sensitive screens:

```tsx
<AIAgent
  instructions={{
    system: 'You are a food delivery assistant.',
    getScreenInstructions: (screenName) => {
      if (screenName === 'Cart') {
        return 'Always confirm the total with the user before checkout.';
      }
    },
  }}
/>
```

### Human-in-the-Loop

Force native confirmation before critical actions:

```tsx
useAction('checkout', 'Place the order', {}, () => {
  return new Promise((resolve) => {
    Alert.alert('Confirm?', 'Place this order?', [
      { text: 'Cancel', onPress: () => resolve({ success: false }) },
      { text: 'Yes', onPress: () => resolve({ success: true }) },
    ]);
  });
});
```

### Lifecycle Hooks

| Prop | Description |
|------|-------------|
| `onBeforeStep` | Called before each agent step. |
| `onAfterStep` | Called after each step with full history. |
| `onBeforeTask` | Called before task execution starts. |
| `onAfterTask` | Called after task completes. |

## 🌐 MCP Bridge (Control Your App from Desktop AI)

The MCP (Model Context Protocol) bridge lets **external AI agents** — like Claude Desktop, OpenClaw, or any MCP-compatible client — remotely control your React Native app through natural language.

### Architecture

```
┌──────────────────┐     SSE/HTTP      ┌──────────────────┐    WebSocket     ┌──────────────────┐
│  Claude Desktop  │ ◄──────────────► │   MCP Server     │ ◄─────────────► │  Your React      │
│  or any MCP      │    (port 3100)   │   (Node.js)      │   (port 3101)   │  Native App      │
│  compatible AI   │                  │                  │                 │                  │
└──────────────────┘                  └──────────────────┘                 └──────────────────┘
```

### How It Works

1. The **MCP server** (included in `mcp-server/`) runs on your machine as a Node.js process
2. Your **React Native app** connects to the server via WebSocket (`ws://localhost:3101`)
3. An **external AI** (e.g., Claude Desktop) connects to the MCP server via SSE (`http://localhost:3100/mcp/sse`)
4. When Claude sends a command like *"Order 2 lemonades"*, the MCP server forwards it to your app
5. Your app's `AgentRuntime` executes the task autonomously and sends back the result

### Setup

**1. Start the MCP server:**

```bash
cd mcp-server
npm install
npm start
```

This starts two servers:
- **HTTP/SSE** on `http://localhost:3100` — for AI clients (Claude, OpenClaw)
- **WebSocket** on `ws://localhost:3101` — for your React Native app

**2. Connect your app:**

```tsx
<AIAgent
  apiKey="YOUR_GEMINI_KEY"
  mcpServerUrl="ws://localhost:3101"
/>
```

**3. Connect Claude Desktop** — add this to your Claude config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "mobile-app": {
      "url": "http://localhost:3100/mcp/sse"
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `execute_task(command)` | Send a natural language task to the app (e.g., *"Add a burger to cart"*) |
| `get_app_status()` | Check if the React Native app is currently connected |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_PORT` | `3100` | HTTP/SSE port for AI clients |
| `WS_PORT` | `3101` | WebSocket port for the React Native app |

## 🛠️ Built-in Tools

| Tool | Description |
|------|-------------|
| `tap(index)` | Tap any interactive element. Works universally on buttons, switches, checkboxes, and custom components. |
| `type(index, text)` | Type text into a text-input. |
| `navigate(screen)` | Navigate to a screen. |
| `capture_screenshot(reason)` | Capture the current screen as an image. Called on-demand by the AI (requires `react-native-view-shot`). |
| `done(text)` | Complete the task with a response. |
| `ask_user(question)` | Ask the user for clarification. |

## 📋 Requirements

- React Native 0.72+
- Expo SDK 49+ (or bare React Native)
- Gemini API key — [Get one free](https://aistudio.google.com/apikey)

## 📄 License

MIT © [Mohamed Salah](https://github.com/mohamed2m2018)
