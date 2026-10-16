# @twomilia/mcp-server

Let Claude Code, Cursor, Claude Desktop or any MCP client drive your running React Native app. Bring your own AI key.

```
MCP client  ── stdio ──►  @twomilia/mcp-server  ── WebSocket :3101 ──►  your app (<AIAgent />)
```

## What you can do

- Ask for a whole task in plain language: "add 2 lemonades to the cart and open checkout".
- Read the live screen and run single actions (tap, type, scroll) yourself, with no AI key at all.
- Test flows on a simulator, emulator or device without writing test code.

## Setup

### 1. Add the server to your MCP client

You need two values: the AI provider (`gemini` or `openai`) and its API key.

**Claude Code**

```bash
claude mcp add react-native -e AI_PROVIDER=gemini -e AI_API_KEY=your-key -- npx -y @twomilia/mcp-server
```

**Claude Desktop, Cursor, Windsurf, Antigravity** (any client with an `mcpServers` JSON config)

```json
{
  "mcpServers": {
    "react-native": {
      "command": "npx",
      "args": ["-y", "@twomilia/mcp-server"],
      "env": {
        "AI_PROVIDER": "gemini",
        "AI_API_KEY": "your-key"
      }
    }
  }
}
```

### 2. Point your app at it

```tsx
import { AIAgent } from '@twomilia/react-native';

export default function App() {
  return (
    <AIAgent mcpServerUrl="ws://localhost:3101" navRef={navRef}>
      {/* your app */}
    </AIAgent>
  );
}
```

On a physical device, use your computer's local IP instead of `localhost` (for example `ws://192.168.1.20:3101`).
On the Android emulator, `ws://10.0.2.2:3101` reaches your computer.

Run the app in a development build. When it connects, the server sends it the provider and key, and every `execute_task` uses them.

## Configuration

| Variable | Required | Default | What it does |
|---|---|---|---|
| `AI_PROVIDER` | with `AI_API_KEY` | none | `gemini` or `openai` |
| `AI_API_KEY` | no | none | Key for that provider. Without it, `execute_task` uses the provider set in the app. |
| `AI_MODEL` | no | provider default | Model id, for example `gemini-3.1-flash-lite` or `gpt-4.1-mini` |
| `WS_PORT` | no | `3101` | Port your app connects to |
| `MCP_TRANSPORT` | no | `stdio` | `stdio`, or `http` to serve `http://localhost:MCP_PORT/mcp` |
| `MCP_PORT` | no | `3100` | HTTP port when `MCP_TRANSPORT=http` |

The server stops with a clear message when the config is wrong (for example a key without a provider).

## Tools

| Tool | What it does | Needs AI key |
|---|---|---|
| `execute_task` | Runs a plain-language task in the app and returns what the agent did | yes (server or app) |
| `get_app_status` | Shows whether the app is connected and which provider MCP tasks use | no |
| `get_screen` | Returns the current screen: text and interactive elements with indexes | no |
| `list_app_tools` | Lists the actions the app exposes (tap, type, scroll, custom actions) | no |
| `call_app_tool` | Runs one action, for example `tap` with `{ "index": 3 }` | no |

`get_screen`, `list_app_tools` and `call_app_tool` work in development builds only.

## How MCP tasks run

MCP tasks run on their own agent inside the app, built from the key you gave the server. The hosted proxy, the support tools (escalate to human, report issue, AI calls) and dashboard-managed actions and knowledge are left out. Your own `customTools`, `instructions` and `knowledgeBase` props still apply. The in-app chat keeps using the app's own settings.

Actions that need approval (payments, sending, deleting) still ask on the device.

## Security

- **Development only.** The API key travels from the server to the app over a local WebSocket with no encryption. Use it on your own machine and network.
- Production builds ignore the key: the app accepts it only in development builds (`__DEV__`).
- Never ship an API key inside a production app. Use a backend proxy there (`proxyUrl`).

## Troubleshooting

- **"The React Native app is not connected"**: start the app and check `mcpServerUrl` (IP address on a device, `10.0.2.2` on the Android emulator).
- **`get_app_status` shows `appUsesServerProvider: false`**: the app refused the key. Its log says why (most often a production build).
- **Port already in use**: set `WS_PORT` in the server env and the same port in `mcpServerUrl`.

## Links

- React Native SDK: [@twomilia/react-native](https://www.npmjs.com/package/@twomilia/react-native)
- [Model Context Protocol](https://modelcontextprotocol.io)
