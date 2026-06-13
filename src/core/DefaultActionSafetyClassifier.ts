import { createProvider } from '../providers/ProviderFactory';
import type {
  ActionSafetyCapability,
  ActionSafetyClassifier,
  ActionSafetyDecision,
  ActionSafetyInput,
  ActionSafetyRisk,
  ActionSafetyScope,
  AgentConfig,
  AIProvider,
  AIProviderName,
  ScreenSafetyInput,
  ToolDefinition,
} from './types';

const LOW_RISK_CAPABILITIES = new Set<ActionSafetyCapability>([
  'screen.read',
  'ui.navigate',
  'ui.scroll',
  'ui.dismiss',
  'support.escalate',
]);

const HIGH_IMPACT_CAPABILITIES = new Set<ActionSafetyCapability>([
  'payment.commit',
  'order.commit',
  'account.security',
  'privacy.sensitive',
  'destructive',
]);

export const DEFAULT_GUARD_MODELS: Record<AIProviderName, string> = {
  gemini: 'gemini-2.5-flash-lite',
  openai: 'gpt-5.4-nano',
};

interface DefaultClassifierOptions {
  config: AgentConfig;
}

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function inferScope(userRequest: string): ActionSafetyScope {
  const request = userRequest.toLowerCase();
  if (includesAny(request, ['late', 'refund', 'missing', 'wrong item', 'support', 'help', 'issue', 'human'])) {
    return 'support_investigation';
  }
  if (includesAny(request, ['buy', 'purchase', 'shop', 'cart', 'checkout', 'order food', 'headphone'])) {
    return 'shopping_preparation';
  }
  if (includesAny(request, ['latest order', 'order status', 'track', 'delivery', 'where is my order', 'check my order'])) {
    return 'read_or_lookup';
  }
  if (includesAny(request, ['fill', 'form', 'setup', 'set up', 'onboard', 'profile'])) {
    return 'form_assistance';
  }
  if (includesAny(request, ['account', 'password', 'security', 'address', 'payment method', 'privacy'])) {
    return 'account_management';
  }
  if (includesAny(request, ['send', 'message', 'email', 'post', 'share', 'publish'])) {
    return 'communication_preparation';
  }
  return 'unknown_task';
}

function capabilityFromEffect(toolName: string, effect?: string): ActionSafetyCapability | null {
  if (toolName === 'scroll') return 'ui.scroll';
  if (toolName === 'dismiss_keyboard') return 'ui.dismiss';
  if (toolName === 'navigate') return 'ui.navigate';
  switch (effect) {
    case 'read':
      return 'screen.read';
    case 'navigate':
      return 'ui.navigate';
    case 'fill':
      return 'ui.fill';
    case 'select':
      return 'ui.select';
    case 'support':
      return 'support.escalate';
    case 'payment':
      return 'payment.commit';
    case 'commit':
      return 'order.commit';
    case 'destructive':
      return 'destructive';
    default:
      return null;
  }
}

function classifyLabel(label: string, screenText: string, toolName: string): ActionSafetyCapability {
  const text = `${label}\n${screenText}`.toLowerCase();
  const labelOnly = label.toLowerCase();

  if (includesAny(labelOnly, ['delete', 'remove account', 'erase', 'wipe', 'reset all', 'destroy'])) {
    return 'destructive';
  }
  if (includesAny(labelOnly, ['change password', 'password', '2fa', 'two-factor', 'security', 'sign out all', 'close account'])) {
    return 'account.security';
  }
  if (includesAny(labelOnly, ['pay', 'payment', 'place order', 'buy now', 'purchase', 'confirm purchase'])) {
    return 'payment.commit';
  }
  if (includesAny(labelOnly, ['submit order', 'confirm order', 'complete order', 'checkout'])) {
    return 'order.commit';
  }
  if (includesAny(labelOnly, ['send', 'post', 'publish', 'share', 'email'])) {
    return 'content.send';
  }
  if (includesAny(labelOnly, ['ssn', 'social security', 'passport', 'private key', 'secret', 'api key'])) {
    return 'privacy.sensitive';
  }
  if (includesAny(labelOnly, ['save', 'submit', 'confirm', 'continue', 'apply', 'add', 'remove', 'update', 'toggle'])) {
    if (includesAny(text, ['card ending', 'billing', 'cvv', 'total $', 'payment', 'pay now', 'place order'])) {
      return 'payment.commit';
    }
    return 'state.modify';
  }
  if (toolName === 'type') return 'ui.fill';
  if (includesAny(labelOnly, ['orders', 'home', 'back', 'track', 'details', 'view', 'open', 'need help', 'support', 'account', 'settings'])) {
    return 'ui.navigate';
  }
  return 'unknown';
}

function riskForCapability(capability: ActionSafetyCapability): ActionSafetyRisk {
  if (capability === 'destructive') return 'critical';
  if (HIGH_IMPACT_CAPABILITIES.has(capability)) return 'high';
  if (capability === 'state.modify' || capability === 'content.send' || capability === 'external.open') {
    return 'medium';
  }
  return 'low';
}

function decisionForCapability(
  scope: ActionSafetyScope,
  capability: ActionSafetyCapability,
  unknownActionDecision: 'ask' | 'block'
): ActionSafetyDecision {
  const risk = riskForCapability(capability);
  if (capability === 'unknown') {
    return {
      decision: unknownActionDecision,
      confidence: 0.45,
      scope,
      capability,
      risk: 'medium',
      reason: 'Default guard could not classify this generic UI action confidently.',
      userMessage: 'I am not fully sure what this action will do. Do you want me to continue?',
    };
  }
  if (capability === 'destructive') {
    return {
      decision: 'ask',
      confidence: 0.9,
      scope,
      capability,
      risk,
      reason: 'Destructive actions require fresh, action-specific confirmation.',
      userMessage: 'This action is destructive and may be irreversible. Do you want me to continue?',
      requiresFreshApproval: true,
    };
  }
  if (HIGH_IMPACT_CAPABILITIES.has(capability)) {
    return {
      decision: 'ask',
      confidence: 0.88,
      scope,
      capability,
      risk,
      reason: `Capability "${capability}" is high impact and requires fresh confirmation.`,
      userMessage: 'This action may make an important change. Do you want me to continue?',
      requiresFreshApproval: true,
    };
  }
  if (capability === 'state.modify') {
    const shoppingPrep = scope === 'shopping_preparation';
    return {
      decision: shoppingPrep ? 'allow' : 'ask',
      confidence: shoppingPrep ? 0.82 : 0.74,
      scope,
      capability,
      risk,
      reason: shoppingPrep
        ? 'Routine shopping preparation state change within the approved task scope.'
        : 'This action may modify app state.',
      userMessage: 'This may update something in the app. Do you want me to continue?',
    };
  }
  if (capability === 'content.send' || capability === 'external.open') {
    return {
      decision: 'ask',
      confidence: 0.82,
      scope,
      capability,
      risk,
      reason: `Capability "${capability}" can affect something outside the current screen.`,
      userMessage: 'This may send or open something outside this screen. Do you want me to continue?',
      requiresFreshApproval: true,
    };
  }
  return {
    decision: LOW_RISK_CAPABILITIES.has(capability) || capability === 'ui.fill' || capability === 'ui.select'
      ? 'allow'
      : 'ask',
    confidence: 0.86,
    scope,
    capability,
    risk,
    reason: `Default guard classified this as ${capability} in ${scope}.`,
  };
}

function buildHeuristicDecision(
  input: ActionSafetyInput,
  unknownActionDecision: 'ask' | 'block'
): ActionSafetyDecision {
  const scope = inferScope(input.userRequest);
  const effectCapability = capabilityFromEffect(input.toolName, input.toolEffect);
  const capability = effectCapability ?? classifyLabel(
    input.targetElement?.label ?? '',
    input.screenContent ?? input.screen?.elementsText ?? '',
    input.toolName
  );
  return decisionForCapability(scope, capability, unknownActionDecision);
}

function normalizeModelDecision(raw: Record<string, any>, fallback: ActionSafetyDecision): ActionSafetyDecision {
  const decision = raw.decision;
  const capability = raw.capability;
  const scope = raw.scope;
  const risk = raw.risk;
  if (!['allow', 'ask', 'block'].includes(decision)) return fallback;
  if (!capability || !scope || !risk) return fallback;
  return {
    decision,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : fallback.confidence,
    reason: typeof raw.reason === 'string' ? raw.reason : fallback.reason,
    userMessage: typeof raw.userMessage === 'string' ? raw.userMessage : fallback.userMessage,
    capability,
    scope,
    risk,
    requiresFreshApproval: raw.requiresFreshApproval === true,
  } as ActionSafetyDecision;
}

export function resolveDefaultGuardModel(config: AgentConfig): string {
  if (config.actionSafety?.guardModel && config.actionSafety.guardModel !== 'auto') {
    return config.actionSafety.guardModel;
  }
  const providerName = config.provider ?? 'gemini';
  return DEFAULT_GUARD_MODELS[providerName];
}

export class DefaultActionSafetyClassifier implements ActionSafetyClassifier {
  private guardProvider: AIProvider | null = null;

  constructor(private readonly options: DefaultClassifierOptions) {}

  async classifyScreen(input: ScreenSafetyInput) {
    const decisions = Object.fromEntries(
      input.screen.elements.flatMap((element) => {
        const decision = buildHeuristicDecision(
          {
            userRequest: input.userRequest,
            toolName: 'tap',
            args: { index: element.index },
            targetElement: element,
            screen: input.screen,
            screenContent: input.screenContent,
            screenSignature: input.screenSignature,
            mode: input.mode,
            history: input.history,
            toolEffect: 'unknown',
          },
          this.options.config.actionSafety?.unknownActionDecision ?? 'ask'
        );
        if (decision.capability === 'unknown') return [];
        return [[element.index, decision]];
      })
    );
    return {
      screenSignature: input.screenSignature,
      decisions,
    };
  }

  async classifyAction(input: ActionSafetyInput): Promise<ActionSafetyDecision> {
    const fallback = buildHeuristicDecision(
      input,
      this.options.config.actionSafety?.unknownActionDecision ?? 'ask'
    );
    if (fallback.decision === 'block' || fallback.requiresFreshApproval || (fallback.confidence ?? 0) >= 0.85) {
      return fallback;
    }

    try {
      const provider = this.getGuardProvider();
      if (!provider) return fallback;
      const result = await provider.generateContent(
        DEFAULT_GUARD_SYSTEM_PROMPT,
        buildGuardUserPrompt(input, fallback),
        [CLASSIFY_ACTION_TOOL],
        []
      );
      const args = result.toolCalls[0]?.args ?? {};
      return normalizeModelDecision(args, fallback);
    } catch {
      return fallback;
    }
  }

  private getGuardProvider(): AIProvider | null {
    if (this.guardProvider) return this.guardProvider;
    const config = this.options.config;
    if (!config.apiKey && !config.proxyUrl) return null;
    this.guardProvider = createProvider(
      config.provider ?? 'gemini',
      config.apiKey,
      resolveDefaultGuardModel(config),
      config.proxyUrl,
      config.proxyHeaders
    );
    return this.guardProvider;
  }
}

function buildGuardUserPrompt(input: ActionSafetyInput, fallback: ActionSafetyDecision): string {
  return JSON.stringify({
    userRequest: input.userRequest,
    toolName: input.toolName,
    args: input.args,
    target: input.targetElement
      ? {
          index: input.targetElement.index,
          type: input.targetElement.type,
          label: input.targetElement.label,
          requiresConfirmation: input.targetElement.requiresConfirmation === true,
        }
      : null,
    screenName: input.screen?.screenName,
    screenContent: input.screenContent ?? input.screen?.elementsText,
    fallback,
  });
}

const DEFAULT_GUARD_SYSTEM_PROMPT = `You are a narrow action safety classifier for a mobile app AI agent.
Return one structured tool call only. Do not chat.
Classify whether the proposed tool action is in scope for the user's current request.
Use allow only for low-risk in-scope actions.
Use ask for ambiguous, state-changing, external-send, payment, order, account-security, privacy-sensitive, or destructive actions.
Use block only for clearly out-of-scope dangerous actions that the user did not request or cannot safely authorize through this app.`;

const CLASSIFY_ACTION_TOOL: ToolDefinition = {
  name: 'classify_action',
  description: 'Classify a proposed mobile app action into a scope, capability, risk, and decision.',
  parameters: {
    decision: { type: 'string', enum: ['allow', 'ask', 'block'], description: 'Runtime decision', required: true },
    scope: {
      type: 'string',
      enum: [
        'read_or_lookup',
        'support_investigation',
        'form_assistance',
        'shopping_preparation',
        'account_management',
        'communication_preparation',
        'unknown_task',
      ],
      description: 'Inferred user task scope',
      required: true,
    },
    capability: {
      type: 'string',
      enum: [
        'screen.read',
        'ui.navigate',
        'ui.scroll',
        'ui.fill',
        'ui.select',
        'ui.dismiss',
        'state.modify',
        'content.send',
        'external.open',
        'support.escalate',
        'payment.commit',
        'order.commit',
        'account.security',
        'privacy.sensitive',
        'destructive',
        'unknown',
      ],
      description: 'App-agnostic capability represented by this action',
      required: true,
    },
    risk: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Risk level', required: true },
    confidence: { type: 'number', description: 'Confidence from 0 to 1', required: true },
    reason: { type: 'string', description: 'Short audit reason', required: true },
    userMessage: { type: 'string', description: 'User-facing message for ask/block decisions', required: true },
    requiresFreshApproval: { type: 'boolean', description: 'Whether existing workflow approval cannot be reused', required: true },
  },
  execute: async () => 'classified',
};
