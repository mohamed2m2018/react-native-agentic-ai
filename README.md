# @mobileai/react-native

> **Autonomous AI agent for React Native** — Your app gets an AI copilot that can see, understand, and interact with your UI. Zero wrappers, zero view rewriting.

[![npm](https://img.shields.io/npm/v/@mobileai/react-native)](https://www.npmjs.com/package/@mobileai/react-native)
[![license](https://img.shields.io/npm/l/@mobileai/react-native)](https://github.com/mohamed2m2018/mobileai-react-native/blob/main/LICENSE)
[![platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-brightgreen)]()

Wrap your navigation with `<AIAgent>`. The AI automatically understands your entire screen — every button, every input, every label — and acts on it.

## ✨ Features

- 🤖 **Zero-config UI understanding** — No need to annotate your views. The AI reads your UI automatically.
- 🧭 **Auto-navigation** — Navigates between screens to complete multi-step tasks.
- 🔒 **Production-grade security** — Element gating, content masking, lifecycle hooks, human-in-the-loop confirmation.
- 🧩 **Custom actions** — Expose any business logic (checkout, API calls) as AI-callable tools with `useAction`.
- 🌐 **MCP bridge** — Let external AI agents (OpenClaw, Claude Desktop) control your app remotely.
- 🌍 **Bilingual** — English and Arabic support built-in.

## 📦 Installation

```bash
npm install @mobileai/react-native
```

No native modules required. Works with Expo managed workflow out of the box — **no eject needed**.

## 🚀 Quick Start

```tsx
import { AIAgent } from '@mobileai/react-native';
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
| `model` | `string` | `'gemini-2.5-flash'` | Gemini model name. |
| `navRef` | `NavigationContainerRef` | — | Navigation ref for auto-navigation. |
| `language` | `'en' \| 'ar'` | `'en'` | UI language. |
| `maxSteps` | `number` | `10` | Max steps per task. |
| `showChatBar` | `boolean` | `true` | Show the floating chat bar. |
| `onResult` | `(result) => void` | — | Called when the agent finishes. |

### `useAction(name, description, params, handler)`

Register a **non-UI action** the AI can call — for business logic that isn't a visible button.

```tsx
import { useAction } from '@mobileai/react-native';

function CartScreen() {
  const { clearCart, getTotal } = useCart();

  useAction('checkout', 'Place the order', {}, async () => {
    const total = getTotal();
    clearCart();
    return { success: true, message: `Order placed! Total: $${total}` };
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
| `tap(index)` | Tap an interactive element. |
| `type(index, text)` | Type text into an input. |
| `navigate(screen)` | Navigate to a screen. |
| `done(text)` | Complete the task. |
| `ask_user(question)` | Ask the user for clarification. |

## 📋 Requirements

- React Native 0.72+
- Expo SDK 49+ (or bare React Native)
- Gemini API key — [Get one free](https://aistudio.google.com/apikey)

## 📄 License

MIT © [Mohamed Salah](https://github.com/mohamed2m2018)
