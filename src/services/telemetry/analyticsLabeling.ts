import type {
  AnalyticsElementKind,
  AnalyticsLabelConfidence,
  ElementType,
} from '../../core/types';

export type AnalyticsLabelSource =
  | 'accessibility'
  | 'deep-text'
  | 'sibling-text'
  | 'placeholder'
  | 'title'
  | 'test-id'
  | 'icon'
  | 'context';

export interface AnalyticsLabelCandidate {
  text?: string | null;
  source: AnalyticsLabelSource;
  isInteractiveContext?: boolean;
}

export interface AnalyticsTargetMetadata {
  label: string | null;
  elementKind: AnalyticsElementKind;
  labelConfidence: AnalyticsLabelConfidence;
  zoneId?: string | null;
  ancestorPath?: string[];
  siblingLabels?: string[];
  componentName?: string | null;
}

const GENERIC_LABELS = new Set([
  'button',
  'buttons',
  'component',
  'components',
  'container',
  'containers',
  'content',
  'cta',
  'item',
  'items',
  'label',
  'labels',
  'root',
  'row',
  'rows',
  'screen',
  'screens',
  'text',
  'texts',
  'title',
  'titles',
  'unknown',
  'value',
  'values',
  'view',
  'views',
  'wrapper',
  'wrappers',
]);

const GENERIC_IDENTIFIER_TOKENS = new Set([
  'btn',
  'button',
  'card',
  'cell',
  'component',
  'container',
  'content',
  'cta',
  'icon',
  'input',
  'item',
  'label',
  'node',
  'pressable',
  'root',
  'row',
  'screen',
  'target',
  'text',
  'tile',
  'toggle',
  'view',
  'wrapper',
]);

const INTERNAL_NAME_PATTERNS = [
  /^RCT[A-Z]/,
  /^React/,
  /^TextImpl/i,
  /^Android/i,
  /^UI[A-Z]/,
  /^RN[A-Z]/,
  /^Virtualized/i,
  /^ScrollResponder$/i,
  /^Animated(Component|.*Wrapper)?$/i,
  /^Touchable[A-Z]/,
  /^Pressable$/i,
  /^View$/i,
  /^Text$/i,
  /^Modal$/i,
  /Legacy/i,
  /Wrapper/i,
  /Context$/i,
  /Provider$/i,
];

function normalizeWhitespace(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function humanizeIdentifier(value: string): string {
  const humanized = value
    .replace(/^icon:/i, '')
    .replace(/[_./-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return toTitleCase(humanized);
}

function stripDecorators(value: string): string {
  return value
    .replace(/^\[[^\]]+\]\s*/g, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();
}

function looksInternal(value: string): boolean {
  return INTERNAL_NAME_PATTERNS.some((pattern) => pattern.test(value));
}

function isLowSignalValue(value: string): boolean {
  const lowered = value.toLowerCase();
  return GENERIC_LABELS.has(lowered);
}

function sanitizeLabelValue(
  rawValue: string | null | undefined,
  source: AnalyticsLabelSource
): string | null {
  let normalized = normalizeWhitespace(rawValue);
  if (!normalized) return null;

  normalized = stripDecorators(normalized);
  if (!normalized) return null;

  if (source === 'test-id' || source === 'icon' || source === 'context') {
    normalized = humanizeIdentifier(normalized);
  }

  if (!normalized) return null;
  if (normalized.length > 80) return null;
  if (looksInternal(normalized)) return null;

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  if (words.length === 1) {
    const token = words[0]!.toLowerCase();
    if (GENERIC_IDENTIFIER_TOKENS.has(token) || GENERIC_LABELS.has(token)) {
      return null;
    }
  }

  if (isLowSignalValue(normalized)) return null;

  return normalized;
}

function scoreAnalyticsLabel(
  label: string,
  source: AnalyticsLabelSource,
  isInteractiveContext = false
): number {
  let score = 0;
  const words = label.split(/\s+/).filter(Boolean);

  if (source === 'accessibility') score += 95;
  if (source === 'deep-text') score += 78;
  if (source === 'sibling-text') score += 64;
  if (source === 'title') score += 56;
  if (source === 'placeholder') score += 42;
  if (source === 'context') score += 12;
  if (source === 'icon') score -= 8;
  if (source === 'test-id') score -= 14;
  if (isInteractiveContext) score += 18;

  if (words.length >= 2 && words.length <= 6) score += 20;
  else if (words.length === 1) score += 4;

  if (label.length >= 4 && label.length <= 36) score += 18;
  else if (label.length > 56) score -= 20;

  if (/^[A-Z]/.test(label)) score += 8;
  if (/[A-Za-z]/.test(label) && !/[_./]/.test(label)) score += 10;

  return score;
}

export function getFallbackAnalyticsLabel(
  elementKind: AnalyticsElementKind
): string | null {
  switch (elementKind) {
    case 'button':
      return 'Primary action';
    case 'text_input':
      return 'Text input';
    case 'toggle':
      return 'Toggle';
    case 'picker':
      return 'Picker';
    case 'slider':
      return 'Slider';
    case 'link':
      return 'Link';
    case 'tab':
      return 'Tab';
    case 'list_item':
      return 'List item';
    case 'image':
      return 'Image';
    case 'icon':
      return 'Icon';
    case 'text':
      return 'Text';
    case 'card':
      return 'Card';
    case 'modal':
      return 'Modal';
    case 'sheet':
      return 'Bottom sheet';
    case 'scroll_area':
      return 'Scrollable area';
    default:
      return null;
  }
}

export function getAnalyticsElementKind(
  elementType?: ElementType | string | null
): AnalyticsElementKind {
  switch (elementType) {
    case 'pressable':
    case 'radio':
    case 'button':
    case 'checkbox':
      return 'button';
    case 'link':
      return 'link';
    case 'tab':
    case 'tabbar':
      return 'tab';
    case 'listitem':
    case 'list-item':
    case 'menuitem':
      return 'list_item';
    case 'text-input':
    case 'text_input':
    case 'textinput':
      return 'text_input';
    case 'switch':
    case 'toggle':
      return 'toggle';
    case 'slider':
      return 'slider';
    case 'picker':
      return 'picker';
    case 'date-picker':
    case 'select':
    case 'dropdown':
      return 'picker';
    case 'image':
    case 'imagebutton':
      return 'image';
    case 'icon':
      return 'icon';
    case 'text':
    case 'label':
    case 'header':
      return 'text';
    case 'card':
      return 'card';
    case 'modal':
      return 'modal';
    case 'sheet':
    case 'bottomsheet':
      return 'sheet';
    case 'scrollable':
    case 'scrollview':
    case 'flatlist':
    case 'sectionlist':
    case 'adjustable':
      return 'scroll_area';
    default:
      return 'unknown';
  }
}

export function chooseBestAnalyticsTarget(
  candidates: AnalyticsLabelCandidate[],
  elementKind: AnalyticsElementKind
): AnalyticsTargetMetadata {
  let best:
    | {
        label: string;
        score: number;
      }
    | undefined;

  for (const candidate of candidates) {
    const label = sanitizeLabelValue(candidate.text, candidate.source);
    if (!label) continue;

    const score = scoreAnalyticsLabel(
      label,
      candidate.source,
      candidate.isInteractiveContext === true
    );
    if (!best || score > best.score) {
      best = { label, score };
    }
  }

  if (best) {
    const labelConfidence: AnalyticsLabelConfidence =
      best.score >= 100 ? 'high' : 'low';
    return {
      label: best.label,
      elementKind,
      labelConfidence,
    };
  }

  return {
    label: getFallbackAnalyticsLabel(elementKind),
    elementKind,
    labelConfidence: 'low',
  };
}
