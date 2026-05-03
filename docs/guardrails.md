# Guardrails

MobileAI is designed as delegated assistance, not user impersonation. The assistant can propose actions, but the runtime owns enforcement.

## Safety Layers

| Layer | Purpose |
| --- | --- |
| Consent | No app context is sent to an AI provider until the user consents, unless you explicitly disable consent. |
| Interaction mode | `companion` guides without UI control, `copilot` performs approved actions, `autopilot` is for trusted low-risk workflows. |
| Workflow approval | Copilot asks before entering an app-action flow. |
| Semantic action safety | Generic UI actions are classified as `allow`, `ask`, or `block` before execution. |
| Element controls | `aiConfirm` forces confirmation. `aiIgnore` removes an element from the assistant target list. |
| Data masking | `transformScreenContent` can redact screen content before provider calls. |
| Audit callbacks | Lifecycle callbacks and `actionSafety.onDecision` expose what the runtime decided. |

## Companion Mode

Companion mode is the safest interaction mode for user trust. The assistant can see the current screen and help the user understand what to do, but the runtime blocks UI-effect tools.

Allowed in companion mode:

- Answering from visible screen content.
- Explaining confusing UI states.
- Giving step-by-step guidance for the user to perform.
- Querying knowledge with `query_knowledge`.
- Querying app data registered through `useData`.
- Calling non-UI support/reporting tools when configured.
- Escalating to a human when the escalation tool is available.

Blocked in companion mode:

- `tap`
- `type`
- `scroll`
- `navigate`
- `long_press`
- `adjust_slider`
- `select_picker`
- `set_date`
- `dismiss_keyboard`
- `guide_user`
- `simplify_zone`
- `render_block`
- `inject_card`
- `restore_zone`

If the assistant tries to use a blocked UI-control tool, the runtime blocks it before execution and responds that it can guide the user, but cannot control the app in companion mode.

```tsx
<AIAgent
  interactionMode="companion"
  analyticsKey="mobileai_pub_xxxxxxxx"
  navRef={navRef}
>
  {children}
</AIAgent>
```

## Default Semantic Safety

In copilot mode, `actionSafety.classifier` defaults to `'default'`. The acting assistant chooses a tool, then the runtime checks the action before `tool.execute`.

The default classifier uses a smaller guard model in the same provider family:

| Provider | Default guard model |
| --- | --- |
| `gemini` | `gemini-2.5-flash-lite` |
| `openai` | `gpt-5.4-nano` |

You can override the guard model:

```tsx
<AIAgent
  provider="openai"
  actionSafety={{
    classifier: 'default',
    guardModel: 'gpt-5.4-nano',
  }}
>
  {children}
</AIAgent>
```

The guard model is advisory. Runtime code remains the final authority.

## Capabilities, Scope, And Risk

The guardrails use app-agnostic semantic fields:

```ts
type ActionSafetyCapability =
  | 'screen.read'
  | 'ui.navigate'
  | 'ui.scroll'
  | 'ui.fill'
  | 'ui.select'
  | 'state.modify'
  | 'content.send'
  | 'support.escalate'
  | 'payment.commit'
  | 'order.commit'
  | 'account.security'
  | 'privacy.sensitive'
  | 'destructive'
  | 'unknown';

type ActionSafetyScope =
  | 'read_or_lookup'
  | 'support_investigation'
  | 'form_assistance'
  | 'shopping_preparation'
  | 'account_management'
  | 'communication_preparation'
  | 'unknown_task';

type ActionSafetyRisk = 'low' | 'medium' | 'high' | 'critical';
```

These fields are used for approval reuse, traces, and overrides. Avoid policy code that depends on a visible button label alone.

## Approval Reuse

The default approval behavior is designed to avoid asking on every tap.

- First workflow approval covers routine in-scope low-risk actions.
- The runtime asks again when the risk category increases or the scope changes.
- High-impact actions require fresh confirmation.
- `block` decisions cannot be overridden by the user.
- `aiConfirm` always asks, even when semantic safety allows the action.

```tsx
<AIAgent
  actionSafety={{
    approvalReuse: 'risk-boundary',
    userOverride: { allowAskDecision: true },
  }}
>
  {children}
</AIAgent>
```

## Runtime Decisions

The runtime enforces three outcomes:

| Decision | Runtime behavior |
| --- | --- |
| `allow` | Execute the tool. |
| `ask` | Show the user a confirmation message. Execute only if approved. |
| `block` | Do not execute. The user cannot approve through the assistant UI. |

Timeouts, invalid classifier output, and low confidence fail safe to `ask` or `block`, depending on your configuration.

```tsx
<AIAgent
  actionSafety={{
    classifierTimeoutMs: 300,
    minConfidenceToAllow: 0.75,
    unknownActionDecision: 'ask',
  }}
>
  {children}
</AIAgent>
```

## Element-Level Controls

Use `aiConfirm` when a specific control should always ask.

```tsx
<Pressable aiConfirm onPress={deleteDraft}>
  <Text>Delete draft</Text>
</Pressable>
```

Use `aiIgnore` when a control should not be visible as an assistant target.

```tsx
<Pressable aiIgnore onPress={deleteAllData}>
  <Text>Delete all data</Text>
</Pressable>
```

These controls are useful, but they are not the only safety mechanism. Default semantic safety still runs for generic UI tools in copilot mode.

## Masking Sensitive Data

Use `transformScreenContent` to redact data before it reaches the provider.

```tsx
<AIAgent
  transformScreenContent={(content) =>
    content
      .replace(/\b\d{4} \d{4} \d{4} \d{4}\b/g, '[card number]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
  }
>
  {children}
</AIAgent>
```

## Decision Tracing

Use `onDecision` while testing guardrails.

```tsx
<AIAgent
  debug
  actionSafety={{
    onDecision: (decision) => {
      console.log({
        decision: decision.decision,
        capability: decision.capability,
        scope: decision.scope,
        risk: decision.risk,
        reason: decision.reason,
        source: decision.source,
      });
    },
  }}
>
  {children}
</AIAgent>
```

## App-Level Overrides

Use `overrideDecision` when your app policy has more context than the SDK default.

Prefer semantic fields such as `capability`, `risk`, and `scope`.

```tsx
<AIAgent
  actionSafety={{
    overrideDecision: (decision) => {
      if (
        decision.decision === 'block' &&
        decision.capability === 'unknown' &&
        decision.scope === 'support_investigation' &&
        decision.risk === 'medium'
      ) {
        return {
          ...decision,
          decision: 'ask',
          reason: 'Allowed by app policy after user confirmation.',
          userMessage: 'This support action needs your approval. Continue?',
        };
      }

      return decision;
    },
  }}
>
  {children}
</AIAgent>
```

## Custom Classifier

You can replace the default classifier with your own.

```tsx
const classifier = {
  async classifyScreen(input) {
    return {
      screenSignature: input.screenSignature,
      decisions: {},
    };
  },

  async classifyAction(input) {
    return {
      decision: 'ask',
      confidence: 0.8,
      reason: 'Custom policy requires confirmation.',
      capability: 'unknown',
      scope: 'unknown_task',
      risk: 'medium',
    };
  },
};

<AIAgent actionSafety={{ classifier }}>{children}</AIAgent>;
```

To disable semantic classification, pass `classifier: false`. Workflow approval, `aiConfirm`, consent, and interaction-mode restrictions still apply.

```tsx
<AIAgent actionSafety={{ classifier: false }}>{children}</AIAgent>
```

## Practical Guidance

- Use companion mode for guidance-only experiences.
- Use `useData` and `useAction` for operations that should be handled through app code.
- Use `aiIgnore` for controls the assistant should never target.
- Use `aiConfirm` for controls that always need user approval.
- Keep destructive, payment, consent, and account-security flows behind explicit app policy.
- Log `onDecision` in development to verify guardrails before shipping.
