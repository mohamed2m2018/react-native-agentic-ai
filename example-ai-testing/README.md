# 🧪 AI-Powered Emulator Testing

> **Zero boilerplate.** Connect your AI editor to the MCP server, point it at the emulator — testing is just a conversation.

## Architecture

```
AI Editor  ──── stdio ────►  MCP Server  ──── WebSocket (3101) ────►  Emulator
(Antigravity,                          (mcp-server/)                            (<AIAgent> +
 Cursor, Claude)                                                                 your app)
```

The AI editor calls `execute_task("tap on Wireless Headphones")` via MCP. The `AIAgent` component on the emulator reads the live UI fiber tree, performs the action, and returns a structured result.

---

## Quick Start

### 1. Start the MCP server
```bash
cd mcp-server && npm start
```

### 2. Connect the app to MCP
Add `mcpServerUrl` in your layout:
```tsx
<AIAgent
  mcpServerUrl={__DEV__ ? 'ws://localhost:3101' : undefined}
  navRef={navRef}
/>
```

### 3. Test — two ways

#### Option A: Direct (Just Talk)
Tell your AI editor:

> "Check if the emulator is connected. Then tap on Wireless Headphones and verify the price matches what was shown in the product list."

The AI editor calls `get_app_status()` → `execute_task(...)` → reports the result. No files, no scripts.

#### Option B: Saved Test Plans (YAML)
Keep test scenarios in your repo. Tell your AI editor:

> "Read `example-ai-testing/tests/bug-hunt.yaml` and run each check on the emulator via MCP."

The AI reads the file as plain text, understands the steps, and calls `execute_task` for each one.

---

## 🐛 Demo: Bug Hunt

This example app has **5 intentional bugs** planted to prove the AI can detect them. The bugs are realistic — the kind that slip through code review:

| # | Bug | File | Type |
|---|-----|------|------|
| 1 | Laptop Stand: $45.99 in list, $49.99 on detail | `index.tsx` vs `[id].tsx` | Data sync |
| 2 | Profile screen missing email address | `two.tsx` | UI regression |
| 3 | Settings missing Help Center link | `settings.tsx` | Missing element |
| 4 | Running Shoes: description says "mesh" but spec says "Leather" | `[id].tsx` | Data contradiction |
| 5 | Yoga Mat: $39.99 in Favorites, $34.99 everywhere else | `favorites.tsx` | Stale data |

### Try it yourself

Tell your AI editor:

> "There are 5 bugs in the example-expo-router app. Connect to the MCP server and find all of them by inspecting each screen on the emulator."

Or use the saved test plan:

> "Read `example-ai-testing/tests/bug-hunt.yaml` and run each check."

---

## Connecting AI Editors

### Antigravity
Use the included workflow:
```
/test-emulator
```
Or give direct commands:
> "Check if the Laptop Stand price is consistent across the home screen and the product detail page."

### Claude Code
```bash
claude mcp add mobile-app -e AI_PROVIDER=gemini -e AI_API_KEY=your-key -- npx -y react-native-agentic-ai
```

### Cursor, Claude Desktop, Windsurf, Cline
Add to the client's `mcpServers` config:
```json
{ "mcpServers": { "mobile-app": { "command": "npx", "args": ["-y", "react-native-agentic-ai"], "env": { "AI_PROVIDER": "gemini", "AI_API_KEY": "your-key" } } } }
```

---

## MCP Tools Available

| Tool | Description |
|------|-------------|
| `execute_task(command)` | Run a plain-language task in the app on the emulator |
| `get_app_status()` | Check if the app is connected and which AI provider tasks use |
| `get_screen()` | Read the current screen with element indexes |
| `list_app_tools()` | List the actions the app exposes |
| `call_app_tool(name, arguments)` | Run one action directly, for example `tap` |

---

## The Closed-Loop (Why This Matters)

The real power isn't just *finding* bugs — it's the **write → test → fix → re-test** loop:

```
Developer: "Add a Clear Cart button and verify it works on the emulator"

AI Editor:
  1. Adds the button to CartScreen.tsx
  2. Calls execute_task("Tap Clear Cart and verify the cart is empty")
  3. Reads result: { success: false, message: "No element 'Clear Cart' found" }
  4. Investigates — realizes it forgot to save. Fixes.
  5. Re-runs execute_task → success
  6. Reports: "Done. Button added and verified."
```

No human touched the emulator. The code was written, tested, and verified autonomously.
