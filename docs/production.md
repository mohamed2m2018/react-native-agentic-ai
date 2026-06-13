# Production

This page covers production setup for networking, analytics, support, consent, and security.

## API Keys And Proxies

Do not ship provider API keys in your mobile app bundle.

Recommended options:

- Use `analyticsKey` with MobileAI Cloud. The SDK sends provider traffic through the hosted project proxy.
- Use `proxyUrl` and route provider calls through your own backend.

```tsx
<AIAgent
  provider="openai"
  proxyUrl="https://api.example.com/mobileai/chat"
  proxyHeaders={{ Authorization: `Bearer ${sessionToken}` }}
>
  {children}
</AIAgent>
```

For local development only:

```tsx
<AIAgent provider="gemini" apiKey="YOUR_DEV_ONLY_KEY">
  {children}
</AIAgent>
```

## Consent

Consent is required by default. The assistant will not send app context to the AI provider until the user explicitly consents.

```tsx
<AIAgent
  consent={{
    required: true,
    persist: true,
  }}
>
  {children}
</AIAgent>
```

If you use persisted consent, install AsyncStorage:

```bash
npm install @react-native-async-storage/async-storage
```

Only disable consent if your app has a separate equivalent consent flow.

```tsx
<AIAgent consent={{ required: false }}>{children}</AIAgent>
```

## Data Masking

Mask sensitive screen content before it reaches the provider.

```tsx
<AIAgent
  transformScreenContent={(content) =>
    content
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[ssn]')
      .replace(/\b\d{4} \d{4} \d{4} \d{4}\b/g, '[card number]')
  }
>
  {children}
</AIAgent>
```

Also use `aiIgnore` for controls the assistant should not target.

```tsx
<TextInput aiIgnore value={cardNumber} onChangeText={setCardNumber} />
```

## Analytics

Pass `analyticsKey` to enable MobileAI analytics, support context, and project knowledge.

```tsx
<AIAgent
  analyticsKey="mobileai_pub_xxxxxxxx"
  userContext={{
    userId: user.id,
    email: user.email,
    plan: user.plan,
  }}
>
  {children}
</AIAgent>
```

Enterprise deployments can route analytics through a backend proxy:

```tsx
<AIAgent
  analyticsKey="mobileai_pub_xxxxxxxx"
  analyticsProxyUrl="https://api.example.com/mobileai/events"
  analyticsProxyHeaders={{ Authorization: `Bearer ${sessionToken}` }}
>
  {children}
</AIAgent>
```

## Human Support

With `analyticsKey`, the SDK can create support tickets in MobileAI Cloud and stream human replies into the assistant UI.

```tsx
<AIAgent
  analyticsKey="mobileai_pub_xxxxxxxx"
  userContext={{
    userId: user.id,
    name: user.name,
    email: user.email,
  }}
  pushToken={expoPushToken}
  pushTokenType="expo"
>
  {children}
</AIAgent>
```

For a custom support backend, register your own escalation tool.

```tsx
import { createEscalateTool } from '@mobileai/react-native';

const escalateTool = createEscalateTool({
  config: {
    provider: 'custom',
    onEscalate: (context) => createTicket(context),
  },
  getContext: () => ({
    currentScreen: currentRouteName,
    originalQuery: lastUserMessage,
    stepsBeforeEscalation: 0,
  }),
  getHistory: () => conversationHistory,
});

<AIAgent customTools={{ escalate_to_human: escalateTool }}>
  {children}
</AIAgent>
```

## Guardrails In Production

Recommended defaults:

```tsx
<AIAgent
  interactionMode="copilot"
  actionSafety={{
    classifier: 'default',
    unknownActionDecision: 'ask',
    approvalReuse: 'risk-boundary',
    classifierTimeoutMs: 300,
    minConfidenceToAllow: 0.75,
  }}
>
  {children}
</AIAgent>
```

Before shipping:

- Add `aiIgnore` to controls the assistant should never target.
- Add `aiConfirm` to controls that always need confirmation.
- Mask sensitive screen text with `transformScreenContent`.
- Log `actionSafety.onDecision` in staging and verify critical flows.
- Prefer `useAction` for app-owned operations that need strong policy checks.
- Keep payment, order placement, deletion, account security, and consent flows behind explicit app policy.

See [guardrails.md](./guardrails.md).

Use companion mode for deployments where the assistant should help without operating the app. It can still answer from screen context, knowledge, and app data, but UI-control tools are blocked by the runtime.

```tsx
<AIAgent
  interactionMode="companion"
  analyticsKey="mobileai_pub_xxxxxxxx"
>
  {children}
</AIAgent>
```

## Voice Mode

Voice mode requires native dependencies and permissions.

```bash
npm install react-native-audio-api expo-speech-recognition
```

```tsx
<AIAgent
  enableVoice
  voiceProxyUrl="wss://api.example.com/mobileai/voice"
  voiceProxyHeaders={{ Authorization: `Bearer ${sessionToken}` }}
>
  {children}
</AIAgent>
```

Configure iOS and Android microphone permissions in your app. Test voice mode in a native build, not Expo Go.

## MCP Tools

Use MCP for development workflows or controlled tool bridges. See [mcp-server/README.md](../mcp-server/README.md).

For production, prefer narrow app-owned `useAction` tools or server-side custom tools with explicit authorization.

## Release Checklist

- Provider traffic goes through MobileAI Cloud or your backend proxy.
- Consent behavior matches your app policy.
- Sensitive fields are masked or ignored.
- Guardrail traces have been reviewed on critical flows.
- `navRef` and `screenMap` are configured.
- Human escalation has been tested end to end.
- Push tokens are optional and handled according to your notification policy.
- Voice permissions are configured if voice mode is enabled.
- `npm run typecheck` passes.
