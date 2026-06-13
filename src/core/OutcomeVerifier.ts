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
  missingFields?: string[];
  validationMessages?: string[];
}

export interface PendingVerification {
  goal: string;
  action: VerificationAction;
  preAction: VerificationSnapshot;
  followupSteps: number;
}

const COMMIT_ACTION_PATTERN = /\b(save|submit|confirm|apply|pay|place|update|continue|finish|send|checkout|complete|verify|review|publish|post|delete|cancel)\b/i;

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStatus(value: unknown): VerificationStatus | undefined {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === 'success' || normalized === 'error' || normalized === 'uncertain') {
    return normalized;
  }
  return undefined;
}

function normalizeFailureKind(value: unknown): VerificationFailureKind | undefined {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === 'controllable' || normalized === 'uncontrollable') {
    return normalized;
  }
  return undefined;
}

function inferVerificationFromText(text: string): VerificationResult | null {
  const normalized = text.toLowerCase();
  if (!normalized) return null;

  const hasSuccessCue = /\b(succeeded|successful|success|completed|created|submitted|confirmed|requested|processed)\b/.test(normalized);
  const hasFailureCue = /\b(failed|failure|error|invalid|required|missing|blocked|unable|cannot|can't)\b/.test(normalized);

  if (hasFailureCue && !hasSuccessCue) {
    return {
      status: 'error',
      failureKind: 'controllable',
      evidence: text,
      source: 'llm',
    };
  }

  if (hasSuccessCue && !hasFailureCue) {
    return {
      status: 'success',
      failureKind: 'controllable',
      evidence: text,
      source: 'llm',
    };
  }

  return null;
}

function parseStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    return items.length > 0 ? items : undefined;
  }

  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      const items = parsed.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
      return items.length > 0 ? items : undefined;
    }
  } catch {
    // Fall back to a simple delimiter split for providers that do not emit JSON.
  }

  const items = trimmed
    .split(/\n|;/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
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

function createUnverifiedResult(): VerificationResult {
  return {
    status: 'uncertain',
    failureKind: 'controllable',
    evidence: 'The verifier model did not return a usable outcome judgment.',
    source: 'deterministic',
  };
}

async function llmVerify(
  provider: AIProvider,
  context: VerificationContext,
  signal?: AbortSignal,
): Promise<VerificationResult | null> {
  const verificationTool: ToolDefinition = {
    name: 'report_verification',
    description: 'Report whether the action succeeded, failed, or remains uncertain based only on the UI evidence.',
    parameters: {
      status: { type: 'string', description: 'success, error, or uncertain', required: true, enum: ['success', 'error', 'uncertain'] },
      failureKind: { type: 'string', description: 'controllable or uncontrollable', required: true, enum: ['controllable', 'uncontrollable'] },
      evidence: { type: 'string', description: 'Brief explanation grounded in the current UI evidence', required: true },
      missingFields: { type: 'string', description: 'Optional JSON array of visible missing fields the user or agent can fill before retrying', required: false },
      validationMessages: { type: 'string', description: 'Optional JSON array of visible validation or error messages from the post-action UI', required: false },
    },
    execute: async () => 'reported',
  };

  const systemPrompt = [
    'You are an outcome verifier for a mobile app agent.',
    'Your job is to decide whether the user goal has actually been achieved based on the UI evidence.',
    'You may be asked to verify a single critical action OR a whole-task completion when the agent calls done(). In both cases the rules are the same.',
    'The current UI is the source of truth. Ignore the actor model’s prior claims when they conflict with the UI.',
    'Compare the pre-action and post-action UI. Treat static warnings, historical issue text, and informational copy that existed before the action as context, not new failure evidence.',
    'When the goal mentions a specific count or quantity (e.g. "add 2 items", "select 3 colors"), the UI must visibly reflect that exact number. Off-by-one mismatches (e.g. cart shows 3 when goal says 2) are errors, not successes.',
    'When the goal names a specific option, variant, or target (e.g. "size M", "blue", "the Cairo branch"), the UI must visibly reflect that exact selection.',
    'Return success only when the current UI clearly proves the goal is satisfied.',
    'Return error when the UI shows validation, verification, submission, or other failure feedback, or when visible state does not match the goal (wrong count, wrong selection, missing item, extra item).',
    'Return uncertain when the UI does not yet prove either success or error.',
    'When returning error, include visible validationMessages and missingFields when the UI makes them clear.',
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
    signal,
  );

  const toolCall = response.toolCalls?.[0];
  if (!toolCall || toolCall.name !== 'report_verification') {
    return null;
  }

  const status = normalizeStatus(toolCall.args.status);
  const failureKind = normalizeFailureKind(toolCall.args.failureKind ?? toolCall.args.failure_kind);
  const evidence = normalizeString(toolCall.args.evidence);
  const missingFields = parseStringArray(toolCall.args.missingFields ?? toolCall.args.missing_fields);
  const validationMessages = parseStringArray(toolCall.args.validationMessages ?? toolCall.args.validation_messages);

  if (!status || !failureKind || !evidence) {
    return inferVerificationFromText(
      [
        normalizeString(response.reasoning?.plan),
        normalizeString(response.text),
        evidence,
      ].filter(Boolean).join(' ')
    );
  }

  return {
    status,
    failureKind,
    evidence,
    source: 'llm',
    missingFields,
    validationMessages,
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

  public async verify(context: VerificationContext, signal?: AbortSignal): Promise<VerificationResult> {
    return (await llmVerify(this.provider, context, signal)) ?? createUnverifiedResult();
  }
}
