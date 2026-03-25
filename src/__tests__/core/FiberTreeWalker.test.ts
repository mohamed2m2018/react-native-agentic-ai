/**
 * FiberTreeWalker tests.
 *
 * Tests with mock fiber node trees (plain JS objects mimicking React Fiber structure).
 * No actual React rendering — focuses on the tree traversal logic.
 */

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock __REACT_DEVTOOLS_GLOBAL_HOOK__ — FiberTreeWalker uses this to access the fiber root
// We bypass it and pass the fiber root directly via getFiberFromRef fallback patterns
import { walkFiberTree, hasAnyEventHandler } from '../../core/FiberTreeWalker';

// ─── Fiber Node Factory ────────────────────────────────────────

/** Creates a mock Fiber node that mimics React's internal fiber structure */
function createFiberNode(
  type: string | { displayName?: string; name?: string } | null,
  props: Record<string, any> = {},
  children: any[] = [],
): any {
  const node: any = {
    type,
    memoizedProps: props,
    child: null,
    sibling: null,
    return: null,
    stateNode: null,
  };

  // Build linked list of children
  if (children.length > 0) {
    node.child = children[0];
    children[0].return = node;
    for (let i = 1; i < children.length; i++) {
      children[i - 1].sibling = children[i];
      children[i].return = node;
    }
  }

  return node;
}

/** Creates a fiber tree root that works with getFiberFromRef's fallback pattern */
function createFiberRoot(rootNode: any): any {
  // Pattern 4: Direct fiber node properties (child, memoizedProps)
  return rootNode;
}

// ─── Tests ─────────────────────────────────────────────────────

describe('FiberTreeWalker', () => {
  describe('element type detection', () => {
    it('detects Pressable as pressable type', () => {
      const pressable = createFiberNode('Pressable', { onPress: () => {} });
      const root = createFiberNode('View', {}, [pressable]);
      const ref = createFiberRoot(root);

      const result = walkFiberTree(ref);

      expect(result.interactives).toHaveLength(1);
      expect(result.interactives[0].type).toBe('pressable');
    });

    it('detects TouchableOpacity as pressable type', () => {
      const touchable = createFiberNode('TouchableOpacity', { onPress: () => {} });
      const root = createFiberNode('View', {}, [touchable]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives).toHaveLength(1);
      expect(result.interactives[0].type).toBe('pressable');
    });

    it('detects TextInput by component name', () => {
      const input = createFiberNode('TextInput', { onChangeText: () => {} });
      const root = createFiberNode('View', {}, [input]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives).toHaveLength(1);
      expect(result.interactives[0].type).toBe('text-input');
    });

    it('detects element with onChangeText prop as text-input', () => {
      const customInput = createFiberNode('CustomInput', { onChangeText: () => {} });
      const root = createFiberNode('View', {}, [customInput]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives).toHaveLength(1);
      expect(result.interactives[0].type).toBe('text-input');
    });

    it('detects Switch by component name', () => {
      const switchNode = createFiberNode('Switch', { onValueChange: () => {} });
      const root = createFiberNode('View', {}, [switchNode]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives).toHaveLength(1);
      expect(result.interactives[0].type).toBe('switch');
    });

    it('detects switch by accessibilityRole', () => {
      const switchNode = createFiberNode('CustomToggle', {
        accessibilityRole: 'switch',
        onValueChange: () => {},
      });
      const root = createFiberNode('View', {}, [switchNode]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives).toHaveLength(1);
      expect(result.interactives[0].type).toBe('switch');
    });
  });

  describe('label extraction', () => {
    it('extracts text from nested Text children', () => {
      const text = createFiberNode('Text', { children: 'Add to Cart' });
      const pressable = createFiberNode('Pressable', { onPress: () => {} }, [text]);
      const root = createFiberNode('View', {}, [pressable]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives[0].label).toBe('Add to Cart');
    });

    it('prefers accessibilityLabel over text content', () => {
      const text = createFiberNode('Text', { children: 'Click Me' });
      const pressable = createFiberNode('Pressable', {
        onPress: () => {},
        accessibilityLabel: 'Submit Order',
      }, [text]);
      const root = createFiberNode('View', {}, [pressable]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives[0].label).toBe('Submit Order');
    });

    it('falls back to placeholder for TextInput', () => {
      const input = createFiberNode('TextInput', {
        onChangeText: () => {},
        placeholder: 'Enter email...',
      });
      const root = createFiberNode('View', {}, [input]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives[0].label).toBe('Enter email...');
    });

    it('falls back to testID when no text or label available', () => {
      const pressable = createFiberNode('Pressable', {
        onPress: () => {},
        testID: 'submit-button',
      });
      const root = createFiberNode('View', {}, [pressable]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives[0].label).toBe('submit-button');
    });
  });

  describe('security constraints', () => {
    it('aiIgnore excludes subtree from output', () => {
      const button = createFiberNode('Pressable', { onPress: () => {} });
      const ignored = createFiberNode('View', { aiIgnore: true }, [button]);
      const root = createFiberNode('View', {}, [ignored]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives).toHaveLength(0);
      expect(result.elementsText).toBe('');
    });

    it('disabled elements are skipped', () => {
      const disabled = createFiberNode('Pressable', {
        onPress: () => {},
        disabled: true,
      });
      const root = createFiberNode('View', {}, [disabled]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives).toHaveLength(0);
    });
  });

  describe('nested interactive dedup', () => {
    it('suppresses nested interactive with same onPress', () => {
      const handler = () => {};
      const inner = createFiberNode('Pressable', { onPress: handler });
      const outer = createFiberNode('Pressable', { onPress: handler }, [inner]);
      const root = createFiberNode('View', {}, [outer]);

      const result = walkFiberTree(createFiberRoot(root));

      // Should only have 1 interactive, not 2 (dedup by same reference)
      expect(result.interactives).toHaveLength(1);
    });

    it('keeps nested interactive with different onPress', () => {
      const inner = createFiberNode('Pressable', { onPress: () => {} });
      const outer = createFiberNode('Pressable', { onPress: () => {} }, [inner]);
      const root = createFiberNode('View', {}, [outer]);

      const result = walkFiberTree(createFiberRoot(root));

      // Different onPress references = separate actions
      expect(result.interactives).toHaveLength(2);
    });
  });

  describe('media detection', () => {
    it('emits [image] tag for Image components', () => {
      const image = createFiberNode('Image', {
        source: { uri: 'https://example.com/photo.jpg' },
        accessibilityLabel: 'Profile photo',
      });
      const root = createFiberNode('View', {}, [image]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.elementsText).toContain('[image');
      expect(result.elementsText).toContain('alt="Profile photo"');
      expect(result.elementsText).toContain('src="https://example.com/photo.jpg"');
    });

    it('emits [video] tag for Video components', () => {
      const video = createFiberNode('Video', {
        source: { uri: 'https://example.com/clip.mp4' },
        paused: true,
      });
      const root = createFiberNode('View', {}, [video]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.elementsText).toContain('[video');
      expect(result.elementsText).toContain('state="paused"');
    });
  });

  describe('edge cases', () => {
    it('returns empty result for null ref', () => {
      const result = walkFiberTree(null);

      expect(result.elementsText).toBe('');
      expect(result.interactives).toEqual([]);
    });

    it('returns empty when no interactive elements exist', () => {
      const text = createFiberNode('Text', { children: 'Hello World' });
      const root = createFiberNode('View', {}, [text]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives).toHaveLength(0);
      expect(result.elementsText).toContain('Hello World');
    });
  });

  describe('hasAnyEventHandler', () => {
    it('returns true for props with on* function', () => {
      expect(hasAnyEventHandler({ onPress: () => {} })).toBe(true);
      expect(hasAnyEventHandler({ onChangeText: () => {} })).toBe(true);
    });

    it('returns false for props without event handlers', () => {
      expect(hasAnyEventHandler({ style: {} })).toBe(false);
      expect(hasAnyEventHandler(null)).toBe(false);
      expect(hasAnyEventHandler({})).toBe(false);
    });
  });
});
