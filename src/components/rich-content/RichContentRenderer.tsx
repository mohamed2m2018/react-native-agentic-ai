import { StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import type { AIRichNode } from '../../core/types';
import { normalizeRichContent } from '../../core/richContent';
import { useBlockRegistry, useRichUITheme } from './RichUIContext';

interface RichContentRendererProps {
  content: AIRichNode[] | string;
  surface: 'chat' | 'support' | 'zone';
  isUser?: boolean;
  textStyle?: any;
}

type InlineMarkdownSegment = {
  text: string;
  style?: 'bold' | 'code';
};

export function parseInlineMarkdown(text: string): InlineMarkdownSegment[] {
  const segments: InlineMarkdownSegment[] = [];
  let cursor = 0;

  const findNextMarker = (from: number) => {
    const candidates = [
      { marker: '**', index: text.indexOf('**', from), style: 'bold' as const },
      { marker: '__', index: text.indexOf('__', from), style: 'bold' as const },
      { marker: '`', index: text.indexOf('`', from), style: 'code' as const },
    ].filter((candidate) => candidate.index >= 0);

    candidates.sort((a, b) => a.index - b.index);
    return candidates[0];
  };

  while (cursor < text.length) {
    const next = findNextMarker(cursor);
    if (!next) {
      segments.push({ text: text.slice(cursor) });
      break;
    }

    if (next.index > cursor) {
      segments.push({ text: text.slice(cursor, next.index) });
    }

    const contentStart = next.index + next.marker.length;
    const contentEnd = text.indexOf(next.marker, contentStart);
    if (contentEnd < 0) {
      segments.push({ text: text.slice(next.index) });
      break;
    }

    const content = text.slice(contentStart, contentEnd);
    if (content) {
      segments.push({ text: content, style: next.style });
    }
    cursor = contentEnd + next.marker.length;
  }

  return segments.filter((segment) => segment.text.length > 0);
}

function renderInlineMarkdown(text: string): ReactNode {
  return parseInlineMarkdown(text).map((segment, index) => {
    if (!segment.style) {
      return segment.text;
    }

    return (
      <Text
        key={`${segment.style}-${index}`}
        style={segment.style === 'bold' ? styles.boldText : styles.codeText}
      >
        {segment.text}
      </Text>
    );
  });
}

export function RichContentRenderer({
  content,
  surface,
  isUser = false,
  textStyle,
}: RichContentRendererProps) {
  const theme = useRichUITheme(surface === 'support' ? 'support' : surface);
  const registry = useBlockRegistry();
  const nodes = normalizeRichContent(content);

  return (
    <View style={styles.container}>
      {nodes.map((node, index) => {
        if (node.type === 'text') {
          return (
            <Text
              key={node.id || `text-${index}`}
              style={[
                styles.text,
                {
                  color:
                    isUser || surface === 'chat' || surface === 'support'
                      ? theme.colors.inverseText
                      : theme.colors.primaryText,
                },
                textStyle,
              ]}
            >
              {renderInlineMarkdown(node.content)}
            </Text>
          );
        }

        const definition = registry.get(node.blockType);
        if (!definition) {
          return null;
        }

        const BlockComponent = definition.component;
        return (
          <View
            key={node.id || `block-${index}`}
            style={[
              styles.blockWrapper,
              surface === 'chat' || surface === 'support'
                ? {
                    backgroundColor: theme.colors.richMessageContainer,
                    borderColor: theme.colors.subtleBorder,
                  }
                : null,
            ]}
          >
            <BlockComponent {...node.props} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  boldText: {
    fontWeight: '700',
  },
  codeText: {
    fontFamily: 'Menlo',
  },
  blockWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
