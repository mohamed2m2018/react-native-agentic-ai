# API Reference

This page summarizes the main public APIs exported by `@mobileai/react-native`.

## Components

### `AIAgent`

`AIAgent` wraps your app and provides the assistant runtime, chat UI, screen inspection, navigation access, guardrails, registered actions, and support features.

```tsx
import { AIAgent } from '@mobileai/react-native';

<AIAgent analyticsKey="mobileai_pub_xxxxxxxx">{children}</AIAgent>;
```

#### Provider And Networking

| Prop | Type | Notes |
| --- | --- | --- |
| `analyticsKey` | `string` | Publishable MobileAI project key. Enables hosted proxy, analytics, knowledge, and support features. |
| `provider` | `'gemini' \| 'openai'` | Text provider. Default: `'gemini'`. |
| `apiKey` | `string` | Local prototyping only. Do not ship provider keys in production apps. |
| `proxyUrl` | `string` | Backend proxy URL for production provider calls. |
| `proxyHeaders` | `Record<string, string>` | Headers sent to `proxyUrl`. |
| `voiceProxyUrl` | `string` | Optional WebSocket URL for voice mode. |
| `voiceProxyHeaders` | `Record<string, string>` | Headers sent to `voiceProxyUrl`. |
| `model` | `string` | Provider-specific model name. |

#### Navigation And Screen Context

| Prop | Type | Notes |
| --- | --- | --- |
| `navRef` | `any` | React Navigation or Expo Router navigation container ref. |
| `router` | `{ push; replace; back }` | Expo Router imperative router. |
| `pathname` | `string` | Current Expo Router pathname. |
| `screenMap` | `ScreenMap` | Generated `ai-screen-map.json`. |
| `useScreenMap` | `boolean` | Include screen map in prompts. Default: `true`. |
| `transformScreenContent` | `(content) => string \| Promise<string>` | Mask or rewrite screen content before provider calls. |

#### Behavior

| Prop | Type | Notes |
| --- | --- | --- |
| `interactionMode` | `'companion' \| 'copilot' \| 'autopilot'` | Default: `'copilot'`. |
| `enableUIControl` | `boolean` | Disable UI-control tools when `false`. |
| `maxSteps` | `number` | Maximum agent steps per user request. |
| `stepDelay` | `number` | Optional delay between steps. |
| `maxTokenBudget` | `number` | Stop when estimated task tokens exceed this value. |
| `maxCostUSD` | `number` | Stop when estimated task cost exceeds this value. |
| `debug` | `boolean` | Enable SDK logs. |
| `interceptNativeAlerts` | `boolean` | Expose native alert buttons as assistant targets. |

Interaction mode behavior:

| Mode | Runtime behavior |
| --- | --- |
| `companion` | Registers guidance/data/support tools and blocks UI-effect tools such as `tap`, `type`, `scroll`, `navigate`, `guide_user`, and rich UI injection tools. |
| `copilot` | Registers UI tools and enforces approval plus semantic action safety before execution. |
| `autopilot` | Registers UI tools for trusted automation flows. Configure safety explicitly for any risky workflow. |

#### Safety

| Prop | Type | Notes |
| --- | --- | --- |
| `consent` | `AIConsentConfig` | Consent is required by default. |
| `actionSafety` | `ActionSafetyConfig` | Semantic action safety configuration. |
| `toolStabilization` | `ToolStabilizationConfig` | Snapshot-based stabilization after UI tools. |
| `verifier` | `VerifierConfig` | Optional outcome verifier for critical actions. |
| `interactiveBlacklist` | `React.RefObject<any>[]` | Refs the assistant must not interact with. |
| `interactiveWhitelist` | `React.RefObject<any>[]` | Restrict assistant interaction to listed refs. |

#### Knowledge, Tools, And Actions

| Prop | Type | Notes |
| --- | --- | --- |
| `knowledgeBase` | `KnowledgeBaseConfig` | Static entries or retriever for app knowledge. |
| `knowledgeMaxTokens` | `number` | Default: `2000`. |
| `customTools` | `Record<string, ToolDefinition \| null>` | Add, override, or remove tools. `null` removes a built-in tool. |
| `mcpServerUrl` | `string` | WebSocket URL for the MCP bridge. |
| `instructions` | `{ system?; getScreenInstructions? }` | App-specific system and per-screen instructions. |

#### UI

| Prop | Type | Notes |
| --- | --- | --- |
| `showChatBar` | `boolean` | Default: `true`. |
| `accentColor` | `string` | Quick color for the chat UI. |
| `theme` | `ChatBarTheme` | Chat UI theme tokens. |
| `blocks` | `Array<BlockDefinition \| React.ComponentType<any>>` | Rich content blocks available to the assistant. |
| `richUITheme` | `RichUIThemeOverride` | Rich UI theme tokens. |
| `richUISurfaceThemes` | `Partial<Record<'chat' \| 'zone' \| 'support', RichUIThemeOverride>>` | Per-surface rich UI tokens. |
| `blockActionHandlers` | `Record<string, BlockActionHandler>` | Handlers for interactive rich blocks. |
| `showDiscoveryTooltip` | `boolean` | Default: `true`. |
| `discoveryTooltipMessage` | `string` | Custom discovery tooltip text. |

#### Support And Analytics

| Prop | Type | Notes |
| --- | --- | --- |
| `supportStyle` | `'warm-concise' \| 'wow-service' \| 'neutral-professional'` | Default: `'warm-concise'`. |
| `userContext` | `{ userId?; name?; email?; phone?; plan?; custom? }` | User profile for support and analytics. |
| `pushToken` | `string` | Device push token for offline support replies. |
| `pushTokenType` | `'fcm' \| 'expo' \| 'apns'` | Push token type. |
| `analyticsProxyUrl` | `string` | Enterprise analytics proxy. |
| `analyticsProxyHeaders` | `Record<string, string>` | Headers for analytics proxy. |
| `proactiveHelp` | `ProactiveHelpConfig` | Proactive help configuration. |
| `customerSuccess` | `CustomerSuccessConfig` | Health score and adoption tracking. |
| `onboarding` | `OnboardingConfig` | Guided onboarding journey configuration. |

#### Lifecycle Callbacks

| Prop | Type |
| --- | --- |
| `onResult` | `(result: ExecutionResult) => void` |
| `onBeforeTask` | `() => void \| Promise<void>` |
| `onAfterTask` | `(result: ExecutionResult) => void \| Promise<void>` |
| `onBeforeStep` | `(stepCount: number) => void \| Promise<void>` |
| `onAfterStep` | `(history: AgentStep[]) => void \| Promise<void>` |
| `onTokenUsage` | `(usage: TokenUsage) => void` |

## Hooks

### `useData`

Registers an app data source.

```tsx
useData(
  name: string,
  description: string,
  schema: Record<string, string | DataFieldDef> | undefined,
  handler: (context: { query: string; screenName: string }) => Promise<unknown> | unknown,
  deps?: React.DependencyList
): void;
```

### `useAction`

Registers an app-owned action.

```tsx
useAction(
  name: string,
  description: string,
  parameters: Record<string, string | ActionParameterDef>,
  handler: (args: Record<string, any>) => any,
  deps?: React.DependencyList
): void;
```

### `useAI`

Reads the current assistant state and sends messages from custom UI.

```tsx
const {
  send,
  isLoading,
  status,
  lastResult,
  messages,
  clearMessages,
  cancel,
} = useAI();
```

You can temporarily disable UI control for a subtree:

```tsx
const { send } = useAI({ enableUIControl: false });
```

## Guardrail Types

### `ActionSafetyConfig`

```ts
interface ActionSafetyConfig {
  enabled?: boolean;
  classifier?: ActionSafetyClassifier | 'default' | false;
  guardModel?: 'auto' | string;
  classifierTimeoutMs?: number;
  minConfidenceToAllow?: number;
  unknownActionDecision?: 'ask' | 'block';
  approvalReuse?: 'risk-boundary' | 'workflow' | 'none';
  userOverride?: {
    allowAskDecision?: boolean;
  };
  overrideDecision?: (decision: ActionSafetyDecisionWithContext) => ActionSafetyDecision | void | null;
  onDecision?: (decision: ActionSafetyDecisionWithContext) => void;
}
```

Defaults in copilot mode:

```ts
{
  enabled: true,
  classifier: 'default',
  guardModel: 'auto',
  classifierTimeoutMs: 300,
  minConfidenceToAllow: 0.75,
  unknownActionDecision: 'ask',
  approvalReuse: 'risk-boundary',
  userOverride: { allowAskDecision: true },
}
```

### `ActionSafetyDecision`

```ts
interface ActionSafetyDecision {
  decision: 'allow' | 'ask' | 'block';
  confidence?: number;
  reason: string;
  userMessage?: string;
  capability?: ActionSafetyCapability;
  scope?: ActionSafetyScope;
  risk?: 'low' | 'medium' | 'high' | 'critical';
  requiresFreshApproval?: boolean;
}
```

### `ToolStabilizationConfig`

```ts
interface ToolStabilizationConfig {
  enabled?: boolean;
  maxMs?: number;
  stableFrames?: number;
}
```

Defaults:

```ts
{
  enabled: true,
  maxMs: 1000,
  stableFrames: 2,
}
```

## Rich UI Types

### `BlockDefinition`

```ts
interface BlockDefinition {
  name: string;
  component: React.ComponentType<any>;
  allowedPlacements: Array<'chat' | 'zone'>;
  propSchema?: Record<string, BlockPropDefinition>;
  previewTextBuilder?: (props: Record<string, unknown>) => string;
  interventionType?: BlockInterventionType;
  interventionEligible?: boolean;
  styleSlots?: string[];
}
```

### `ChatBarTheme`

```ts
interface ChatBarTheme {
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  inputBackgroundColor?: string;
  successColor?: string;
  errorColor?: string;
}
```

## Support Helpers

### `buildSupportPrompt`

Builds support-focused system instructions.

```tsx
import { buildSupportPrompt } from '@mobileai/react-native';

const system = buildSupportPrompt({
  enabled: true,
  persona: { agentName: 'Nora', preset: 'warm-concise' },
  autoEscalateTopics: ['account deletion'],
});
```

### `createEscalateTool`

Creates a custom escalation tool if you are not using MobileAI Cloud escalation.

```tsx
import { createEscalateTool } from '@mobileai/react-native';

const escalateTool = createEscalateTool({
  config: {
    provider: 'custom',
    onEscalate: (context) => sendToHelpdesk(context),
  },
  getContext: () => ({
    currentScreen: 'Orders',
    originalQuery: 'My order is late',
    stepsBeforeEscalation: 3,
  }),
  getHistory: () => [],
});
```

## Other Exports

The package also exports:

- Providers: `GeminiProvider`, `OpenAIProvider`, `createProvider`, `ReactNativePlatformAdapter`
- Voice services: `VoiceService`, `AudioInputService`, `AudioOutputService`
- Knowledge services: `KnowledgeBaseService`, `createMobileAIKnowledgeRetriever`
- Analytics: `MobileAI`
- Support UI and transport: `CSATSurvey`, `EscalationSocket`
- Rich UI: `RichContentRenderer`, `RichUIProvider`, built-in blocks, and primitives
