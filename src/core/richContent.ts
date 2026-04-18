import type { AIMessage, AIRichNode, AIRichTextNode, ExecutionResult } from './types';

function makeTextNode(content: string, id?: string): AIRichTextNode {
  return {
    type: 'text',
    content,
    id,
  };
}

export function createTextContent(content: string, id?: string): AIRichNode[] {
  return [makeTextNode(content, id)];
}

export function normalizeRichContent(
  input: AIRichNode[] | string | null | undefined,
  fallbackText = '',
): AIRichNode[] {
  if (Array.isArray(input)) {
    const normalizedNodes = input
      .map<AIRichNode | null>((node, index) => {
        if (!node) return null;
        if (node.type === 'text') {
          return makeTextNode(typeof node.content === 'string' ? node.content : '', node.id || `text-${index}`);
        }

        if (node.type === 'block' && typeof node.blockType === 'string') {
          return {
            type: 'block' as const,
            blockType: node.blockType,
            props: node.props && typeof node.props === 'object' ? node.props : {},
            id: node.id || `block-${index}`,
            placement: node.placement,
            lifecycle: node.lifecycle,
          };
        }

        return null;
      });
    return normalizedNodes.filter((node): node is AIRichNode => node !== null);
  }

  if (typeof input === 'string') {
    return createTextContent(input);
  }

  return createTextContent(fallbackText);
}

export function richContentToPlainText(
  input: AIRichNode[] | string | null | undefined,
  fallbackText = '',
): string {
  const content = normalizeRichContent(input, fallbackText);
  const parts = content.flatMap((node) => {
    if (node.type === 'text') {
      return node.content.trim() ? [node.content.trim()] : [];
    }

    const props = node.props || {};
    const textBits = [
      typeof props.title === 'string' ? props.title : '',
      typeof props.subtitle === 'string' ? props.subtitle : '',
      typeof props.description === 'string' ? props.description : '',
      typeof props.body === 'string' ? props.body : '',
      typeof props.headline === 'string' ? props.headline : '',
    ].filter(Boolean);

    return textBits;
  });

  return parts.join('\n').trim() || fallbackText;
}

export function createAIMessage(params: {
  id: string;
  role: AIMessage['role'];
  content: AIRichNode[] | string;
  timestamp: number;
  result?: ExecutionResult;
  promptKind?: AIMessage['promptKind'];
  previewText?: string;
}): AIMessage {
  const content = normalizeRichContent(params.content);
  return {
    id: params.id,
    role: params.role,
    content,
    previewText: params.previewText || richContentToPlainText(content),
    timestamp: params.timestamp,
    result: params.result,
    promptKind: params.promptKind,
  };
}

export function normalizeExecutionResult(result: ExecutionResult): ExecutionResult {
  const reply = normalizeRichContent(result.reply || result.message, result.message);
  const previewText = result.previewText || richContentToPlainText(reply, result.message);
  return {
    ...result,
    reply,
    previewText,
    message: result.message || previewText,
  };
}
