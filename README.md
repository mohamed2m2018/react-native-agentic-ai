# AI Support That Resolves — Not Deflects

> **Drop in one React Native component and your app gets AI support that answers questions, navigates users to the right screen, fills forms, and resolves issues end-to-end — with live human backup when needed. No custom API connectors required — the app UI is already the integration.**

**Two names, one package — pick whichever you prefer:**

```bash
npm install @mobileai/react-native
# — or —
npm install react-native-agentic-ai
```

### 🤖 AI Support Agent — Answers, Acts, and Resolves Inside Your App

<p align="center">
  <img src="./assets/demo.gif" alt="AI Support Agent navigating the app and resolving user issues end-to-end" width="350" />
</p>

---

[![npm](https://img.shields.io/npm/v/@mobileai/react-native?label=%40mobileai%2Freact-native)](https://www.npmjs.com/package/@mobileai/react-native)

[![npm](https://img.shields.io/npm/v/react-native-agentic-ai?label=react-native-agentic-ai)](https://www.npmjs.com/package/react-native-agentic-ai)

[![license](https://img.shields.io/npm/l/@mobileai/react-native)](https://github.com/MobileAIAgent/react-native/blob/main/LICENSE)

[![platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-brightgreen)]()

**Two names, one package** — install either: `@mobileai/react-native` or `react-native-agentic-ai`

> ⭐ If this helped you, [star this repo](https://github.com/MobileAIAgent/react-native) — it helps others find it!

---

## 💡 The Problem With Every Support Tool Today

Intercom, Zendesk, and every chat widget all do the same thing: send the user instructions in a chat bubble.

*"To cancel your order, go to Orders, tap the order, then tap Cancel."*

That's not support. That's documentation delivery with a chat UI.

**This SDK takes a different approach.** Instead of telling users where to go, it — with the user's permission — goes there for them.

---

## 🧠 How It Works — The App's UI Is the Integration Layer

Every other support tool needs you to build API connectors: endpoints, webhooks, action definitions in their dashboard. Months of backend work before the AI can do anything useful.

This SDK reads your app's live UI natively — every button, label, input, and screen — in real time. **There's nothing to integrate. The UI is already the integration.** The app already knows how to cancel orders, update addresses, apply promo codes — it has buttons for all of it. The AI just uses them.

**No OCR. No image pipelines. No selectors. No annotations. No backend connectors.**

### Why This Matters in the Support Context

The most important insight: UI control is only uncomfortable when it's unexpected. In a support conversation, the user has already asked for help — they're in a *"please help me"* mindset:

| Context | User reaction to AI controlling UI |
|:---|:---|
| Unprompted (out of nowhere) | 😨 "What is happening?" |
| **In a support chat — user asked for help** | 😊 "Yes please, do it for me" |
| **User is frustrated and types "how do I..."** | 😮‍💨 "Thank God, yes" |

---

## 🎟️ The 5-Level Support Ladder

The SDK handles every tier of support automatically — from a simple FAQ answer to live human chat:

```
┌──────────────────────────────────────────────────────┐
│  Level 1: Knowledge Answer                           │
│  Answers from knowledge base — instant, zero UI     │
│  "What's your return policy?" → answered directly    │
├──────────────────────────────────────────────────────┤
│  Level 2: Show & Guide                               │
│  AI navigates to exact screen, user acts last        │
│  "Settings → Notifications. It's right here. ☘️"     │
├──────────────────────────────────────────────────────┤
│  Level 3: Do & Confirm (Copilot — default)           │
│  AI fills forms, user confirms the final action      │
│  "I've typed your new address. Tap Save to confirm." │
├──────────────────────────────────────────────────────┤
│  Level 4: Full Resolution (Autopilot)                │
│  AI completes entire flow with one permission gate   │
│  "Done! Order #4521 cancelled. Refund in 3-5 days." │
├──────────────────────────────────────────────────────┤
│  Level 5: Human Escalation                           │
│  Live agent via WebSocket — seamless handoff         │
│  Billing dispute, legal issues, edge cases           │
└──────────────────────────────────────────────────────┘
```

### Example conversations

<details>
<summary><b>Level 1 — Knowledge Answer</b></summary>

```
User: "What's your return policy?"
AI:   "You can return items within 30 days. Full refund in 5-7 business days."
      [from knowledge base — no UI needed]
```
</details>

<details>
<summary><b>Level 2 — Show & Guide</b></summary>

```
User: "How do I turn on price alerts?"
AI:   "That's in Settings → Notifications. Want me to take you there?"
User: "Yes"
AI:   [navigates to Settings → scrolls to Notifications section]
AI:   "Here it is. The Price Alerts toggle is right here. ☘️"
      [user taps the toggle themselves]
```
</details>

<details>
<summary><b>Level 3 — Do & Confirm (Copilot, default)</b></summary>

```
User: "I need to change my shipping address"
AI:   "Sure! I'll navigate to your address settings."
      [navigates to Profile → Address]
AI:   "What's the new address?"
User: "15 Omar St, Nasr City, Cairo"
AI:   [types the address into the fields]
AI:   "I've filled in '15 Omar St, Nasr City, Cairo'. Tap Save to confirm."
      [user taps Save themselves]
```
</details>

<details>
<summary><b>Level 4 — Full Resolution (Autopilot)</b></summary>

```
User: "Cancel my last order"
AI:   "Order #4521 — Margherita pizza, $12.99. Want me to cancel it?"
User: "Yes"
AI:   [navigates to Orders → finds #4521 → taps Cancel → taps Confirm]
AI:   "Done! Order #4521 is cancelled. Refund arrives in 3-5 days."
```
</details>

<details>
<summary><b>Level 5 — Human Escalation</b></summary>

```
User: "I was charged twice for my order"
AI:   "I can see your order history, but billing disputes need a human agent."
      [triggers escalate → live agent chat via WebSocket]
```
</details>

---

## ⚙️ Why Not Intercom or Zendesk?

| | Intercom Fin | Zendesk AI | **This SDK** |
|:---|:---|:---|:---|
| **Answer questions** | ✅ | ✅ | ✅ Knowledge base |
| **Navigate user to right screen** | ❌ | ❌ | ✅ App-aware navigation |
| **Fill forms for the user** | ❌ | ❌ | ✅ Types directly into fields |
| **Execute in-app actions** | Via API connectors *(must build)* | Via API connectors | ✅ Via UI — zero backend work |
| **Voice support** | ❌ | ❌ | ✅ Gemini Live |
| **Human escalation** | ✅ | ✅ | ✅ WebSocket live chat |
| **Mobile-native** | ❌ WebView overlay | ❌ WebView | ✅ React Native component |
| **Setup time** | Days–weeks (build connectors) | Days–weeks | **Minutes** (`<AIAgent>` wrapper) |
| **Price per resolution** | $0.99 + subscription | $1.50–2.00 | You decide |

### The moat

No competitor can do Levels 2–4. Intercom and Zendesk answer questions (Level 1) and escalate to humans (Level 5). The middle — **app-aware navigation, form assistance, and full in-app resolution** — is uniquely possible because this SDK reads the React Native Fiber tree. That can't be added with a plugin or API connector.

---

## ✨ What's Inside

### Support Your Users

#### 🦹 AI Support Agent — Resolves at Every Level

The AI answers questions, guides users to the right screen, fills forms on their behalf, or completes full task flows — with voice support and human escalation built in. All in the existing app UI. Zero backend integration.

- **Zero-config** — wrap your app with `<AIAgent>`, done. No annotations, no selectors, no API connectors
- **5-level resolution** — knowledge answer → guided navigation → copilot → full resolution → human escalation
- **Copilot mode** (default) — AI pauses once before irreversible actions (order, delete, submit). User always stays in control
- **Human escalation** — live chat via WebSocket, CSAT survey, ticket dashboard — all built in
- **Knowledge base** — policies, FAQs, product data queried on demand — no token waste

#### 🎤 Real-time Voice Support — Users Speak, AI Acts

Full bidirectional voice AI powered by the Gemini Live API. Users speak their support request; the agent responds with voice AND navigates, fills forms, and resolves issues simultaneously.

- **Sub-second latency** — real-time audio via WebSockets, not turn-based
- **Full resolution** — same navigate, type, tap as text mode — all by voice
- **Screen-aware** — auto-detects screen changes and updates context instantly

> 💡 **Speech-to-text in text mode:** Install `expo-speech-recognition` for a mic button in the chat bar — letting users dictate instead of typing. Separate from voice mode.

#### 🍎 Siri & Spotlight — Trigger Actions Hands-Free (iOS 16+)

Every `useAction` you register automatically becomes a **Siri shortcut** and **Spotlight action**. One config plugin added at build time — no Swift required — and users can say:

> *"Hey Siri, track my order in MyApp"*
> *"Hey Siri, checkout in MyApp"*
> *"Hey Siri, cancel my last order in MyApp"*

<details>
<summary><b>Setup — Expo Config Plugin</b></summary>

```json
// app.json
{
  "expo": {
    "plugins": [
      ["@mobileai/react-native/withAppIntents", {
        "scanDirectory": "src",
        "appScheme": "myapp"
      }]
    ]
  }
}
```

After `npx expo prebuild`, every registered `useAction` is available in Siri and Spotlight automatically.

**Or generate manually:**

```bash
# Scan useAction calls → intent-manifest.json
npx @mobileai/react-native generate-intents src

# Generate Swift AppIntents code
npx @mobileai/react-native generate-swift intent-manifest.json myapp
```

</details>

> ⚠️ iOS 16+ only. Android equivalent (Google Assistant App Actions) is on the roadmap.

---

### Supercharge Your Dev Workflow


#### 🔌 MCP Bridge — Test Your App in English, Not Code

Your app becomes MCP-compatible with one prop. Connect any AI — Antigravity, Claude Desktop, CI/CD pipelines — to remotely read and control the running app. Find bugs without writing a single test.

**MCP-only mode — just want testing? No chat popup needed:**

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

<details>
<summary><b>💬 Human Support &amp; Ticket Persistence</b> — persist tickets and discovery tooltip state across sessions</summary>

```bash
npx expo install @react-native-async-storage/async-storage
```

**Optional** but recommended when using:
- **Human escalation support** — tickets survive app restarts
- **Discovery tooltip** — remembers if the user has already seen it

Without it, both features gracefully degrade: tickets are only visible during the current session, and the tooltip shows every launch instead of once.

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

## 🛡️ Copilot Mode — Safe-by-Default UI Automation

The agent operates in **copilot mode** by default. It navigates, scrolls, types, and fills forms silently — then pauses **once** before the final irreversible action (place order, delete account, submit payment) to ask the user for confirmation.

```tsx
// Default — copilot mode, zero extra config:
<AIAgent apiKey="..." navRef={navRef}>
  <App />
</AIAgent>
```

**What the AI does silently:**
- Navigating between screens and tabs
- Scrolling to find content
- Typing into form fields
- Selecting options and filters
- Adding items to cart

**What the AI pauses on** (asks the user first):
- Placing an order / completing a purchase
- Submitting a form that sends data to a server
- Deleting anything (account, item, message)
- Confirming a payment or transaction
- Saving account/profile changes

### Opt-out to Full Autonomy

```tsx
<AIAgent interactionMode="autopilot" />
```

Use `autopilot` for power users, accessibility tools, or repeat-task automation where confirmations are unwanted.

### Optional: Mark Specific Buttons as Critical (Safety Net)

In copilot mode, the prompt handles ~95% of cases automatically. For extra safety on your most sensitive buttons, add `aiConfirm={true}` — this adds a code-level block that cannot be bypassed even if the LLM ignores the prompt:

```tsx
// These elements will ALWAYS require confirmation before the AI touches them
<Pressable aiConfirm onPress={deleteAccount}>
  <Text>Delete Account</Text>
</Pressable>

<Pressable aiConfirm onPress={placeOrder}>
  <Text>Place Order</Text>
</Pressable>

<TextInput aiConfirm placeholder="Credit card number" />
```

`aiConfirm` works on any interactive element: `Pressable`, `TextInput`, `Slider`, `Picker`, `Switch`, `DatePicker`.

> 💡 **Dev tip**: In `__DEV__` mode, the SDK logs a reminder to add `aiConfirm` to critical elements after each copilot task.

### Three-Layer Safety Model

| Layer | Mechanism | Developer effort |
|:---|:---|:---|
| **Prompt** (primary) | AI uses `ask_user` before irreversible commits | Zero |
| **`aiConfirm` prop** (optional safety net) | Code blocks specific elements | Add prop to 2–3 critical buttons |
| **Dev warning** (preventive) | Logs tip in `__DEV__` mode | Zero |

---

## 💬 Human Support Mode

Transform the AI agent into a production-grade support system. The AI resolves issues directly inside your app UI — no backend API integrations required. When it can't help, it escalates to a live human agent.

```tsx
import { SupportGreeting, buildSupportPrompt, createEscalateTool } from '@mobileai/react-native';

<AIAgent
  apiKey="..."
  analyticsKey="mobileai_pub_xxx" // required for MobileAI escalation
  instructions={{
    system: buildSupportPrompt({
      enabled: true,
      greeting: {
        message: "Hi! 👋 How can I help you today?",
        agentName: "Support",
      },
      quickReplies: [
        { label: "Track my order", icon: "📦" },
        { label: "Cancel order", icon: "❌" },
        { label: "Talk to a human", icon: "👤" },
      ],
      escalation: { provider: 'mobileai' },
      csat: { enabled: true },
    }),
  }}
  customTools={{ escalate: createEscalateTool({ provider: 'mobileai' }) }}
  userContext={{
    userId: user.id,
    name: user.name,
    email: user.email,
    plan: 'pro',
  }}
>
  <App />
</AIAgent>
```

### What Happens on Escalation

1. AI creates a ticket in the **MobileAI Dashboard** inbox
2. User receives a real-time live chat thread (WebSocket)
3. Support agent replies — user sees messages instantly
4. Ticket is closed when resolved — a CSAT survey appears

### Escalation Providers

| Provider | What happens |
|:---|:---|
| `'mobileai'` | Ticket → MobileAI Dashboard inbox + WebSocket live chat |
| `'custom'` | Calls your `onEscalate` callback — wire to Intercom, Zendesk, etc. |

```tsx
// Custom provider — bring your own live chat:
createEscalateTool({
  provider: 'custom',
  onEscalate: (context) => {
    Intercom.presentNewConversation();
    // context includes: userId, message, screenName, chatHistory
  },
})
```

### User Context

Pass user identity to the escalation ticket for agent visibility in the dashboard:

```tsx
<AIAgent
  userContext={{
    userId: 'usr_123',
    name: 'Ahmed Hassan',
    email: 'ahmed@example.com',
    plan: 'pro',
    custom: { region: 'cairo', language: 'ar' },
  }}
  pushToken={expoPushToken}      // for offline support reply notifications
  pushTokenType="expo"            // 'fcm' | 'expo' | 'apns'
/>
```

### `SupportGreeting` — Standalone Greeting Component

Render the support greeting independently if you have a custom chat UI:

```tsx
import { SupportGreeting } from '@mobileai/react-native';

<SupportGreeting
  message="Hi! 👋 How can I help?"
  agentName="Support"
  quickReplies={[
    { label: 'Track order', icon: '📦' },
    { label: 'Talk to human', icon: '👤' },
  ]}
  onQuickReply={(text) => send(text)}
/>
```

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

#### Core

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `apiKey` | `string` | — | API key for your provider (prototyping only — use `proxyUrl` in production). |
| `provider` | `'gemini' \| 'openai'` | `'gemini'` | LLM provider for text mode. |
| `proxyUrl` | `string` | — | Backend proxy URL (production). Routes all LLM traffic through your server. |
| `proxyHeaders` | `Record<string, string>` | — | Auth headers for proxy (e.g., `Authorization: Bearer ${token}`). |
| `voiceProxyUrl` | `string` | — | Dedicated proxy for Voice Mode WebSockets. Falls back to `proxyUrl`. |
| `voiceProxyHeaders` | `Record<string, string>` | — | Auth headers for voice proxy. |
| `model` | `string` | Provider default | Model name (e.g. `gemini-2.5-flash`, `gpt-4.1-mini`). |
| `navRef` | `NavigationContainerRef` | — | Navigation ref for auto-navigation. |
| `children` | `ReactNode` | — | Your app — zero changes needed inside. |

#### Behavior

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `interactionMode` | `'copilot' \| 'autopilot'` | `'copilot'` | **Copilot** (default): AI pauses before irreversible actions. **Autopilot**: full autonomy, no confirmation. |
| `showDiscoveryTooltip` | `boolean` | `true` | Show one-time animated tooltip on FAB explaining AI capabilities. Dismissed after 6s or first tap. |
| `maxSteps` | `number` | `25` | Max agent steps per task. |
| `maxTokenBudget` | `number` | — | Max total tokens before auto-stopping the agent loop. |
| `maxCostUSD` | `number` | — | Max estimated cost (USD) before auto-stopping. |
| `stepDelay` | `number` | — | Delay between agent steps in ms. |
| `enableUIControl` | `boolean` | `true` | When `false`, AI becomes knowledge-only (faster, fewer tokens). |
| `enableVoice` | `boolean` | `false` | Show voice mode tab. |
| `showChatBar` | `boolean` | `true` | Show the floating chat bar. |

#### Navigation

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `screenMap` | `ScreenMap` | — | Pre-generated screen map from `generate-map` CLI. |
| `useScreenMap` | `boolean` | `true` | Set `false` to disable screen map without removing the prop. |
| `router` | `{ push, replace, back }` | — | Expo Router instance (from `useRouter()`). |
| `pathname` | `string` | — | Current pathname (from `usePathname()` — Expo Router). |

#### AI

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `instructions` | `{ system?, getScreenInstructions? }` | — | Custom system prompt + per-screen instructions. |
| `customTools` | `Record<string, ToolDefinition \| null>` | — | Add custom tools or remove built-in ones (set to `null`). |
| `knowledgeBase` | `KnowledgeEntry[] \| { retrieve }` | — | Domain knowledge the AI can query via `query_knowledge`. |
| `knowledgeMaxTokens` | `number` | `2000` | Max tokens for knowledge results. |
| `transformScreenContent` | `(content: string) => string` | — | Transform/mask screen content before the LLM sees it. |

#### Security

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `interactiveBlacklist` | `React.RefObject<any>[]` | — | Refs of elements the AI must NOT interact with. |
| `interactiveWhitelist` | `React.RefObject<any>[]` | — | If set, AI can ONLY interact with these elements. |

#### Support

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `userContext` | `{ userId?, name?, email?, plan?, custom? }` | — | Logged-in user identity — attached to escalation tickets. |
| `pushToken` | `string` | — | Push token for offline support reply notifications. |
| `pushTokenType` | `'fcm' \| 'expo' \| 'apns'` | — | Type of the push token. |

#### Proactive Help

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `proactiveHelp` | `ProactiveHelpConfig` | — | Detects user hesitation and shows a contextual help nudge. |

```tsx
<AIAgent
  proactiveHelp={{
    enabled: true,
    pulseAfterMinutes: 2,        // subtle FAB pulse to catch attention
    badgeAfterMinutes: 4,        // badge: "Need help with this screen?"
    badgeText: "Need help?",
    dismissForSession: true,     // once dismissed, won't show again this session
    generateSuggestion: (screen) => {
      if (screen === 'Checkout') return 'Having trouble with checkout?';
      return undefined;
    },
  }}
/>
```

#### Analytics

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `analyticsKey` | `string` | — | Publishable key (`mobileai_pub_xxx`) — enables auto-analytics. |
| `analyticsProxyUrl` | `string` | — | Enterprise: route events through your backend. |
| `analyticsProxyHeaders` | `Record<string, string>` | — | Auth headers for analytics proxy. |

#### MCP

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mcpServerUrl` | `string` | — | WebSocket URL for the MCP bridge (e.g. `ws://localhost:3101`). |

#### Lifecycle & Callbacks

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onResult` | `(result) => void` | — | Called when agent finishes a task. |
| `onBeforeTask` | `() => void` | — | Called before task execution starts. |
| `onAfterTask` | `(result) => void` | — | Called after task completes. |
| `onBeforeStep` | `(stepCount) => void` | — | Called before each agent step. |
| `onAfterStep` | `(history) => void` | — | Called after each step (with full step history). |
| `onTokenUsage` | `(usage) => void` | — | Token usage data per step. |
| `onAskUser` | `(question) => Promise<string>` | — | Custom handler for `ask_user` — agent blocks until resolved. |

#### Theming

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `accentColor` | `string` | — | Quick accent color for FAB, send button, active states. |
| `theme` | `ChatBarTheme` | — | Full chat bar theme override. |
| `debug` | `boolean` | `false` | Enable SDK debug logging. |

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
// AI will never see or interact with this element:
<Pressable aiIgnore={true}><Text>Admin Panel</Text></Pressable>

// In copilot mode, AI must confirm before touching this element:
<Pressable aiConfirm={true} onPress={deleteAccount}>
  <Text>Delete Account</Text>
</Pressable>
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
| `onBeforeTask` | Before task execution starts |
| `onBeforeStep` | Before each agent step |
| `onAfterStep` | After each step (with full history) |
| `onAfterTask` | After task completes (success or failure) |

---

## 🧩 AIZone — Contextual AI Regions

`AIZone` marks specific sections of your UI so the AI can operate within them with special capabilities: simplify cluttered areas, inject contextual cards, or highlight elements.

```tsx
import { AIZone } from '@mobileai/react-native';

// Allow AI to simplify this zone if it's too cluttered
<AIZone id="product-details" allowSimplify>
  <View>
    <Text aiPriority="high">Price: $29.99</Text>
    <Text aiPriority="low">SKU: ABC-123</Text>
    <Text aiPriority="low">Weight: 500g</Text>
  </View>
</AIZone>

// Allow AI to inject contextual cards (e.g. "Need help?" dialogs)
<AIZone id="checkout-summary" allowInjectCard allowHighlight>
  <CheckoutSummary />
</AIZone>
```

### `aiPriority` Attribute

Tag any element with `aiPriority` to control AI visibility:

| Value | Effect |
|:---|:---|
| `"high"` | Always rendered — surfaced first in AI context |
| `"low"` | Hidden when AI calls `simplify_zone()` on the enclosing `AIZone` |

### AIZone Props

| Prop | Type | Description |
|:---|:---|:---|
| `id` | `string` | Unique zone identifier the AI uses to target operations |
| `allowSimplify` | `boolean` | AI can call `simplify_zone(id)` to hide `aiPriority="low"` elements |
| `allowHighlight` | `boolean` | AI can visually highlight elements inside this zone |
| `allowInjectHint` | `boolean` | AI can inject a contextual text hint into this zone |
| `allowInjectCard` | `boolean` | AI can inject a pre-built card template into this zone |

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
