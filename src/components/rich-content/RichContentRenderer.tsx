import { StyleSheet, Text, View } from 'react-native';
import type { AIRichNode } from '../../core/types';
import { normalizeRichContent } from '../../core/richContent';
import { useBlockRegistry, useRichUITheme } from './RichUIContext';

interface RichContentRendererProps {
  content: AIRichNode[] | string;
  surface: 'chat' | 'support' | 'zone';
  isUser?: boolean;
  textStyle?: any;
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
              {node.content}
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
  blockWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
