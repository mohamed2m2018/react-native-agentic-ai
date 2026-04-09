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
import { logger } from '../../utils/logger';

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
      expect(result.interactives[0]!.type).toBe('pressable');
    });

    it('detects TouchableOpacity as pressable type', () => {
      const touchable = createFiberNode('TouchableOpacity', { onPress: () => {} });
      const root = createFiberNode('View', {}, [touchable]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives).toHaveLength(1);
      expect(result.interactives[0]!.type).toBe('pressable');
    });

    it('detects TextInput by component name', () => {
      const input = createFiberNode('TextInput', { onChangeText: () => {} });
      const root = createFiberNode('View', {}, [input]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives).toHaveLength(1);
      expect(result.interactives[0]!.type).toBe('text-input');
    });

    it('detects element with onChangeText prop as text-input', () => {
      const customInput = createFiberNode('CustomInput', { onChangeText: () => {} });
      const root = createFiberNode('View', {}, [customInput]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives).toHaveLength(1);
      expect(result.interactives[0]!.type).toBe('text-input');
    });

    it('detects Switch by component name', () => {
      const switchNode = createFiberNode('Switch', { onValueChange: () => {} });
      const root = createFiberNode('View', {}, [switchNode]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives).toHaveLength(1);
      expect(result.interactives[0]!.type).toBe('switch');
    });

    it('detects switch by accessibilityRole', () => {
      const switchNode = createFiberNode('CustomToggle', {
        accessibilityRole: 'switch',
        onValueChange: () => {},
      });
      const root = createFiberNode('View', {}, [switchNode]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives).toHaveLength(1);
      expect(result.interactives[0]!.type).toBe('switch');
    });

    it('detects radio buttons by component name without relying on accessibility', () => {
      const radioNode = createFiberNode('RadioButton', {
        onPress: () => {},
        status: 'unchecked',
      }, [createFiberNode('Text', { children: 'English' })]);
      const root = createFiberNode('View', {}, [radioNode]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives).toHaveLength(1);
      expect(result.interactives[0]!.type).toBe('radio');
      expect(result.interactives[0]!.label).toBe('English');
    });

    it('detects radio group items from common library patterns and infers checked state', () => {
      const radioItem = createFiberNode('RadioGroupItem', {
        value: 'en',
      });
      const labelBlock = createFiberNode('View', {}, [
        createFiberNode('Text', { children: 'English' }),
      ]);
      const row = createFiberNode('View', {}, [labelBlock, radioItem]);
      const group = createFiberNode('RadioGroup', {
        value: 'en',
        onValueChange: () => {},
      }, [row]);
      const root = createFiberNode('View', {}, [group]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives).toHaveLength(1);
      expect(result.interactives[0]!.type).toBe('radio');
      expect(result.interactives[0]!.label).toBe('English');
      expect(result.interactives[0]!.props.checked).toBe(true);
      expect(result.elementsText).toContain('checked="true"');
    });

    it('does not treat a bare adjustable container as a slider', () => {
      const adjustableContainer = createFiberNode('View', {
        accessibilityRole: 'adjustable',
      });
      const root = createFiberNode('View', {}, [adjustableContainer]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives).toHaveLength(0);
    });

    it('detects custom adjustable controls with numeric value semantics as sliders', () => {
      const sliderNode = createFiberNode('CustomAdjustable', {
        accessibilityRole: 'adjustable',
        onValueChange: () => {},
        value: 0.5,
      });
      const root = createFiberNode('View', {}, [sliderNode]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives).toHaveLength(1);
      expect(result.interactives[0]!.type).toBe('slider');
    });
  });

  describe('label extraction', () => {
    it('extracts text from nested Text children', () => {
      const text = createFiberNode('Text', { children: 'Add to Cart' });
      const pressable = createFiberNode('Pressable', { onPress: () => {} }, [text]);
      const root = createFiberNode('View', {}, [pressable]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives[0]!.label).toBe('Add to Cart');
    });

    it('prefers accessibilityLabel over text content', () => {
      const text = createFiberNode('Text', { children: 'Click Me' });
      const pressable = createFiberNode('Pressable', {
        onPress: () => {},
        accessibilityLabel: 'Submit Order',
      }, [text]);
      const root = createFiberNode('View', {}, [pressable]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives[0]!.label).toBe('Submit Order');
    });

    it('prefers visible nested text over low-signal accessibility labels', () => {
      const nestedText = createFiberNode('Text', { children: 'Subscriptions' });
      const wrapper = createFiberNode({ displayName: 'ShortcutCard' }, {}, [nestedText]);
      const pressable = createFiberNode('Pressable', {
        onPress: () => {},
        accessibilityLabel: 'button',
      }, [wrapper]);
      const root = createFiberNode('View', {}, [pressable]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives[0]!.label).toBe('Subscriptions');
    });

    it('falls back to placeholder for TextInput', () => {
      const input = createFiberNode('TextInput', {
        onChangeText: () => {},
        placeholder: 'Enter email...',
      });
      const root = createFiberNode('View', {}, [input]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives[0]!.label).toBe('Enter email...');
    });

    it('falls back to testID when no text or label available', () => {
      const pressable = createFiberNode('Pressable', {
        onPress: () => {},
        testID: 'submit-button',
      });
      const root = createFiberNode('View', {}, [pressable]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives[0]!.label).toBe('submit-button');
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

    it('keeps nested switch controls with distinct onValueChange handlers', () => {
      const switchNode = createFiberNode('Switch', { onValueChange: () => {}, value: false });
      const labelBlock = createFiberNode('View', {}, [
        createFiberNode('Text', { children: 'Express Delivery' }),
        createFiberNode('Text', { children: 'Arrives in 1-2 business days' }),
      ]);
      const outer = createFiberNode('Pressable', { onPress: () => {} }, [labelBlock, switchNode]);
      const root = createFiberNode('View', {}, [outer]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives).toHaveLength(2);
      const nestedSwitch = result.interactives.find(el => el.type === 'switch');
      expect(nestedSwitch).toBeDefined();
      expect(nestedSwitch!.label).toContain('Express Delivery');
    });

    it('keeps child switches inside adjustable containers and labels them from sibling text', () => {
      const switchNode = createFiberNode('Switch', { onValueChange: () => {}, value: false });
      const labelBlock = createFiberNode('View', {}, [
        createFiberNode('Text', { children: 'Gift Wrapping' }),
        createFiberNode('Text', { children: 'Include a personalized message' }),
      ]);
      const adjustableContainer = createFiberNode('View', { accessibilityRole: 'adjustable' }, [labelBlock, switchNode]);
      const root = createFiberNode('View', {}, [adjustableContainer]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives).toHaveLength(1);
      expect(result.interactives[0]!.type).toBe('switch');
      expect(result.interactives[0]!.label).toContain('Gift Wrapping');
    });

    it('suppresses nested radio indicators that reuse the row tap handler', () => {
      const handler = () => {};
      const radioIndicator = createFiberNode('RadioButton', {
        onPress: handler,
        status: 'checked',
      });
      const row = createFiberNode('Pressable', { onPress: handler }, [
        createFiberNode('Text', { children: 'Arabic' }),
        radioIndicator,
      ]);
      const root = createFiberNode('View', {}, [row]);

      const result = walkFiberTree(createFiberRoot(root));

      expect(result.interactives).toHaveLength(1);
      expect(result.interactives[0]!.type).toBe('pressable');
      expect(result.interactives[0]!.label).toContain('Arabic');
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

  // ─── getFiberFromRef Resolution Strategies ───────────────────
  // These tests verify each Fiber access strategy individually,
  // ensuring the walker works in BOTH dev and release builds.

  describe('getFiberFromRef resolution', () => {
    it('resolves fiber via __reactFiber$ key (primary strategy, works in release)', () => {
      // Simulate what a real <View ref={ref}> looks like at runtime:
      // The native host node has a __reactFiber$<hash> key pointing to its Fiber node.
      const fiberNode = createFiberNode('View', {}, [
        createFiberNode('Pressable', { onPress: () => {} }),
      ]);
      const nativeViewHandle = {
        '__reactFiber$abc123': fiberNode,
      };

      const result = walkFiberTree(nativeViewHandle);

      expect(result.interactives).toHaveLength(1);
      expect(result.interactives[0]!.type).toBe('pressable');
    });

    it('resolves fiber via _reactInternals (class component pattern)', () => {
      const fiberNode = createFiberNode('View', {}, [
        createFiberNode('TextInput', { onChangeText: () => {}, placeholder: 'Email' }),
      ]);
      const classComponentRef = {
        _reactInternals: fiberNode,
      };

      const result = walkFiberTree(classComponentRef);

      expect(result.interactives).toHaveLength(1);
      expect(result.interactives[0]!.type).toBe('text-input');
    });

    it('resolves fiber via direct fiber node properties (test pattern)', () => {
      // This is the pattern used by all existing tests — ref IS the fiber
      const fiberNode = createFiberNode('View', {}, [
        createFiberNode('Switch', { onValueChange: () => {} }),
      ]);

      const result = walkFiberTree(fiberNode);

      expect(result.interactives).toHaveLength(1);
      expect(result.interactives[0]!.type).toBe('switch');
    });

    it('works in release build simulation (no DevTools hook, uses __reactFiber$)', () => {
      // Ensure __REACT_DEVTOOLS_GLOBAL_HOOK__ is NOT available
      const originalHook = (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      delete (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;

      try {
        const fiberNode = createFiberNode('View', {}, [
          createFiberNode('Pressable', { onPress: () => {} }, [
            createFiberNode('Text', { children: 'Submit Order' }),
          ]),
        ]);
        // Simulate native View handle with __reactFiber$ key
        const nativeRef = { '__reactFiber$release123': fiberNode };

        const result = walkFiberTree(nativeRef);

        expect(result.interactives).toHaveLength(1);
        expect(result.interactives[0]!.label).toBe('Submit Order');
      } finally {
        // Restore hook if it existed
        if (originalHook) {
          (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = originalHook;
        }
      }
    });

    it('returns empty result and warns when all strategies fail', () => {
      const originalHook = (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      delete (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;

      try {
        (logger.warn as jest.Mock).mockClear();

        // Pass an object with no fiber access patterns
        const opaqueRef = { someRandomProp: 42 };

        const result = walkFiberTree(opaqueRef);

        expect(result.elementsText).toBe('');
        expect(result.interactives).toEqual([]);
        expect(logger.warn).toHaveBeenCalledWith(
          'FiberTreeWalker',
          'Could not access Fiber tree from ref'
        );
      } finally {
        if (originalHook) {
          (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = originalHook;
        }
      }
    });
  });
});
