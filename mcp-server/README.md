# @mobileai/mcp-server

> The Model Context Protocol (MCP) bridge for React Native. Connect any AI (like Claude Desktop or Google Antigravity) to your React Native app.

This is the companion MCP server for the [`@mobileai/react-native`](https://www.npmjs.com/package/@mobileai/react-native) package. It lets AI tools inspect and control a running React Native app for UI testing, debugging, and automation.

It acts as a local proxy that translates standard MCP traffic (from AI editors/agents) into WebSockets that communicate directly with your running React Native app (iOS/Android emulator or physical device).

---

## ⚡ What this enables

1. **AI-Powered UI Testing**: Connect an AI to your emulator and ask it to "verify the checkout flow" in English. The AI will read your live app UI, tap buttons, fill forms, and report bugs — without writing any test code.
2. **App Remote Control**: Let autonomous agents interact with your live app to scrape data, navigate screens, or perform automated tasks.

---

## 🚀 Quick Setup

### 1. Start the MCP Server

You don't even need to install it. Just run it via `npx`:

```bash
npx @mobileai/mcp-server
```

*(By default, it listens on port `3100` for HTTP/SSE MCP traffic, and port `3101` for the React Native WebSocket).*

### 2. Connect Your React Native App

In your app, pass the `mcpServerUrl` prop to your `<AIAgent>`:

```tsx
import { AIAgent } from '@mobileai/react-native';

export default function App() {
  return (
    <AIAgent 
      mcpServerUrl="ws://localhost:3101" 
      apiKey="YOUR_API_KEY"
      navRef={navRef}
    >
      {/* Your app components */}
    </AIAgent>
  );
}
```

### 3. Connect Your AI Client

Configure your AI tool to connect to the MCP server:

**Google Antigravity:**
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

**Claude Desktop:**
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "mobile-app": {
      "url": "http://localhost:3100/mcp/sse"
    }
  }
}
```

*(Once connected, the AI will automatically discover the tools `execute_task` and `get_app_status` to interact with your app).*

---

## ⚙️ Configuration (Environment Variables)

You can customize the ports by setting environment variables before running the server:

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_PORT` | `3100` | HTTP port that AI clients (Claude, Antigravity) connect to |
| `WS_PORT` | `3101` | WebSocket port that your React Native app connects to |

**Example:**
```bash
MCP_PORT=8080 WS_PORT=8081 npx @mobileai/mcp-server
```

---

## 🔗 Links

- **Main Repository:** [github.com/MobileAIAgent/react-native](https://github.com/MobileAIAgent/react-native)
- **React Native SDK:** [@mobileai/react-native](https://www.npmjs.com/package/@mobileai/react-native)
- **MCP Specification:** [Model Context Protocol](https://modelcontextprotocol.io)
