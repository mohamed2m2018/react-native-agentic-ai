import type {
  AIProvider,
  AgentConfig,
  InteractiveElement,
  ToolDefinition,
} from './types';

export type VerificationStatus = 'success' | 'error' | 'uncertain';
export type VerificationFailureKind = 'controllable' | 'uncontrollable';

export interface VerificationSnapshot {
  screenName: string;
  screenContent: string;
  elements: InteractiveElement[];
  screenshot?: string;
}

export interface VerificationAction {
  toolName: string;
  args: Record<string, any>;
  label: string;
  targetElement?: InteractiveElement;
}

export interface VerificationContext {
  goal: string;
  action: VerificationAction;
  preAction: VerificationSnapshot;
  postAction: VerificationSnapshot;
}

export interface VerificationResult {
  status: VerificationStatus;
  failureKind: VerificationFailureKind;
  evidence: string;
  source: 'deterministic' | 'llm';
}

export interface PendingVerification {
  goal: string;
  action: VerificationAction;
  preAction: VerificationSnapshot;
  followupSteps: number;
}

const COMMIT_ACTION_PATTERN = /\b(save|submit|confirm|apply|pay|place|update|continue|finish|send|checkout|complete|verify|review|publish|post|delete|cancel)\b/i;
const SUCCESS_SIGNAL_PATTERNS = [
  /\b(success|successful|saved|updated|submitted|completed|done|confirmed|applied|verified)\b/i,
  /\bthank you\b/i,
  /\border confirmed\b/i,
  /\bchanges saved\b/i,
];
const ERROR_SIGNAL_PATTERNS = [
  /\berror\b/i,
  /\bfailed\b/i,
  /\binvalid\b/i,
  /\brequired\b/i,
  /\bincorrect\b/i,
  /\btry again\b/i,
  /\bcould not\b/i,
  /\bunable to\b/i,
  /\bverification\b.{0,30}\b(error|failed|invalid|required)\b/i,
  /\bcode\b.{0,30}\b(error|failed|invalid|required)\b/i,
];
const UNCONTROLLABLE_ERROR_PATTERNS = [
  /\bnetwork\b/i,
  /\bserver\b/i,
  /\bservice unavailable\b/i,
  /\btemporarily unavailable\b/i,
  /\btimeout\b/i,
  /\btry later\b/i,
  /\bconnection\b/i,
];

function normalizeText(text: string): string {
  return text.replace(/\[[^\]]+\]/g, ' ').replace(/\s+/g, ' ').trim();
}

function elementStillPresent(elements: InteractiveElement[], target?: InteractiveElement): boolean {
  if (!target) return false;
  return elements.some((element) => (
    element.index === target.index
      || (
        element.type === target.type
        && element.label.trim().length > 0
        && element.label.trim() === target.label.trim()
      )
  ));
}

export function createVerificationSnapshot(
  screenName: string,
  screenContent: string,
  elements: InteractiveElement[],
  screenshot?: string,
): VerificationSnapshot {
  return { screenName, screenContent, elements, screenshot };
}

export function buildVerificationAction(
  toolName: string,
  args: Record<string, any>,
  elements: InteractiveElement[],
  fallbackLabel: string,
): VerificationAction {
  const targetElement = typeof args.index === 'number'
    ? elements.find((element) => element.index === args.index)
    : undefined;

  return {
    toolName,
    args,
    label: targetElement?.label || fallbackLabel,
    targetElement,
  };
}

export function isCriticalVerificationAction(action: VerificationAction): boolean {
  if (action.targetElement?.requiresConfirmation) return true;

  if (!['tap', 'long_press', 'adjust_slider', 'select_picker', 'set_date'].includes(action.toolName)) {
    return false;
  }

  const label = action.label || '';
  return COMMIT_ACTION_PATTERN.test(label);
}

function deterministicVerify(context: VerificationContext): VerificationResult {
  const normalizedPost = normalizeText(context.postAction.screenContent);

  if (ERROR_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalizedPost))) {
    const failureKind = UNCONTROLLABLE_ERROR_PATTERNS.some((pattern) => pattern.test(normalizedPost))
      ? 'uncontrollable'
      : 'controllable';
    return {
      status: 'error',
      failureKind,
      evidence: 'Visible validation or error feedback appeared after the action.',
      source: 'deterministic',
    };
  }

  if (context.postAction.screenName !== context.preAction.screenName) {
    return {
      status: 'success',
      failureKind: 'controllable',
      evidence: `The app navigated from "${context.preAction.screenName}" to "${context.postAction.screenName}".`,
      source: 'deterministic',
    };
  }

  if (SUCCESS_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalizedPost))) {
    return {
      status: 'success',
      failureKind: 'controllable',
      evidence: 'The current screen shows explicit success or completion language.',
      source: 'deterministic',
    };
  }

  if (
    context.action.targetElement
    && elementStillPresent(context.preAction.elements, context.action.targetElement)
    && !elementStillPresent(context.postAction.elements, context.action.targetElement)
  ) {
    return {
      status: 'success',
      failureKind: 'controllable',
      evidence: 'The commit control is no longer present on the current screen.',
      source: 'deterministic',
    };
  }

  return {
    status: 'uncertain',
    failureKind: 'controllable',
    evidence: 'The current UI does not yet prove either success or failure.',
    source: 'deterministic',
  };
}

async function llmVerify(
  provider: AIProvider,
  context: VerificationContext,
): Promise<VerificationResult | null> {
  const verificationTool: ToolDefinition = {
    name: 'report_verification',
    description: 'Report whether the action succeeded, failed, or remains uncertain based only on the UI evidence.',
    parameters: {
      status: { type: 'string', description: 'success, error, or uncertain', required: true, enum: ['success', 'error', 'uncertain'] },
      failureKind: { type: 'string', description: 'controllable or uncontrollable', required: true, enum: ['controllable', 'uncontrollable'] },
      evidence: { type: 'string', description: 'Brief explanation grounded in the current UI evidence', required: true },
    },
    execute: async () => 'reported',
  };

  const systemPrompt = [
    'You are an outcome verifier for a mobile app agent.',
    'Your job is to decide whether the last critical UI action actually succeeded.',
    'The current UI is the source of truth. Ignore the actor model’s prior claims when they conflict with the UI.',
    'Return success only when the current UI clearly proves completion.',
    'Return error when the UI shows validation, verification, submission, or other failure feedback.',
    'Return uncertain when the UI does not yet prove either success or error.',
  ].join(' ');

  const userPrompt = [
    `<goal>${context.goal}</goal>`,
    `<action tool="${context.action.toolName}" label="${context.action.label}">${JSON.stringify(context.action.args)}</action>`,
    `<pre_action screen="${context.preAction.screenName}">\n${context.preAction.screenContent}\n</pre_action>`,
    `<post_action screen="${context.postAction.screenName}">\n${context.postAction.screenContent}\n</post_action>`,
  ].join('\n\n');

  const response = await provider.generateContent(
    systemPrompt,
    userPrompt,
    [verificationTool],
    [],
    context.postAction.screenshot,
  );

  const toolCall = response.toolCalls?.[0];
  if (!toolCall || toolCall.name !== 'report_verification') {
    return null;
  }

  const status = toolCall.args.status as VerificationStatus | undefined;
  const failureKind = toolCall.args.failureKind as VerificationFailureKind | undefined;
  const evidence = typeof toolCall.args.evidence === 'string' ? toolCall.args.evidence : '';

  if (!status || !failureKind || !evidence) {
    return null;
  }

  return {
    status,
    failureKind,
    evidence,
    source: 'llm',
  };
}

export class OutcomeVerifier {
  constructor(
    private readonly provider: AIProvider,
    private readonly config: AgentConfig,
  ) {}

  public isEnabled(): boolean {
    return this.config.verifier?.enabled !== false;
  }

  public getMaxFollowupSteps(): number {
    return this.config.verifier?.maxFollowupSteps ?? 2;
  }

  public isCriticalAction(action: VerificationAction): boolean {
    return isCriticalVerificationAction(action);
  }

  public async verify(context: VerificationContext): Promise<VerificationResult> {
    const stageA = deterministicVerify(context);
    if (stageA.status !== 'uncertain') {
      return stageA;
    }

    const stageB = await llmVerify(this.provider, context);
    return stageB ?? stageA;
  }
}
