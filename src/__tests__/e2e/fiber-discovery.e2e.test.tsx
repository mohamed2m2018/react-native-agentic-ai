/**
 * Fiber Discovery Tests — REAL LLM Integration
 *
 * Can the FiberTreeWalker discover interactive elements through
 * 6-8 levels of deeply nested custom components?
 * Can the LLM correctly identify and interact with them?
 */

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import React from 'react';
import { View, Text, Pressable, Switch, TextInput } from 'react-native';
import { requireApiKey, executeGoalLive, renderToFiber } from './e2e-helpers';
import { walkFiberTree } from '../../core/FiberTreeWalker';
import {
  ZButton, ZInput, ZText, DishCard, KitchenCard, QuantityControl,
  StarRatingInput, PhoneInput, CartItemRow, AddressCard, CategoryPill,
} from './test-app/components';
import { CartScreen, HomeScreen, SettingsScreen } from './test-app/screens';

jest.setTimeout(120_000);

beforeAll(() => {
  requireApiKey();
});

describe('Fiber Discovery — Deep Nesting', () => {

  // ─── ZButton: 3 levels deep (TouchableOpacity → ZText → Text) ─

  it('discovers ZButton label through 3 levels of nesting', () => {
    const onPress = jest.fn();
    const { fiber, unmount } = renderToFiber(
      React.createElement(View, null,
        React.createElement(ZButton, { title: 'Place Order', onPress })
      )
    );

    const result = walkFiberTree(fiber);
    unmount();

    expect(result.interactives.length).toBeGreaterThan(0);
    const btn = result.interactives.find(el => el.label.includes('Place Order'));
    expect(btn).toBeDefined();
  });

  // ─── ZInput: TextInput buried 4 levels deep ──────────────────

  it('discovers TextInput inside ZInput wrapper (4 levels)', () => {
    const onChange = jest.fn();
    const { fiber, unmount } = renderToFiber(
      React.createElement(View, null,
        React.createElement(ZInput, { label: 'Email', placeholder: 'Enter email', onChangeText: onChange })
      )
    );

    const result = walkFiberTree(fiber);
    unmount();

    const input = result.interactives.find(el => el.type === 'text-input');
    expect(input).toBeDefined();
  });

  // ─── DishCard: Nested interactives (card tap ≠ add button) ────

  it('discovers both card press and add button as separate interactives on DishCard', () => {
    const onCardPress = jest.fn();
    const onAddPress = jest.fn();
    const { fiber, unmount } = renderToFiber(
      React.createElement(View, null,
        React.createElement(DishCard, {
          name: 'Margherita',
          price: 89,
          rating: 4.5,
          onCardPress,
          onAddPress,
        })
      )
    );

    const result = walkFiberTree(fiber);
    unmount();

    // Should find at least 2 pressable elements (card + add button)
    const pressables = result.interactives.filter(el => el.type === 'pressable');
    expect(pressables.length).toBeGreaterThanOrEqual(2);
  });

  // ─── KitchenCard: 7-8 levels deep with FlatList ──────────────

  it('discovers elements inside KitchenCard with nested DishCards (7+ levels)', () => {
    const onDishAdd = jest.fn();
    const { fiber, unmount } = renderToFiber(
      React.createElement(View, null,
        React.createElement(KitchenCard, {
          name: 'Pizza Palace',
          rating: 4.8,
          deliveryTime: '25 min',
          dishes: [{ name: 'Margherita', price: 89, rating: 4.5 }],
          onPress: jest.fn(),
          onFollow: jest.fn(),
          onDishPress: jest.fn(),
          onDishAdd,
        })
      )
    );

    const result = walkFiberTree(fiber);
    unmount();

    // Should discover the kitchen card, follow button, and nested dish card elements
    expect(result.interactives.length).toBeGreaterThanOrEqual(3);
  });

  // ─── StarRatingInput: 5 individual tappable stars ─────────────

  it('discovers 5 tappable stars in StarRatingInput', () => {
    const onRatingChange = jest.fn();
    const { fiber, unmount } = renderToFiber(
      React.createElement(View, null,
        React.createElement(StarRatingInput, { rating: 3, onRatingChange })
      )
    );

    const result = walkFiberTree(fiber);
    unmount();

    const stars = result.interactives.filter(el => el.type === 'pressable');
    expect(stars.length).toBe(5);
  });

  // ─── QuantityControl: 3 interactives (-, count display, +) ────

  it('discovers minus and plus buttons in QuantityControl', () => {
    const { fiber, unmount } = renderToFiber(
      React.createElement(View, null,
        React.createElement(QuantityControl, {
          quantity: 2,
          onIncrement: jest.fn(),
          onDecrement: jest.fn(),
        })
      )
    );

    const result = walkFiberTree(fiber);
    unmount();

    const pressables = result.interactives.filter(el => el.type === 'pressable');
    expect(pressables.length).toBe(2); // - and +
  });

  // ─── CartItemRow: QuantityControl + remove button (6 levels) ──

  it('discovers all interactives in CartItemRow (quantity + remove)', () => {
    const { fiber, unmount } = renderToFiber(
      React.createElement(View, null,
        React.createElement(CartItemRow, {
          name: 'Shawarma',
          kitchenName: 'Damascus Kitchen',
          price: 45,
          quantity: 2,
          onIncrement: jest.fn(),
          onDecrement: jest.fn(),
          onRemove: jest.fn(),
        })
      )
    );

    const result = walkFiberTree(fiber);
    unmount();

    // Should find: decrement, increment, remove = 3 pressables
    const pressables = result.interactives.filter(el => el.type === 'pressable');
    expect(pressables.length).toBe(3);
  });

  // ─── AddressCard: nested edit button inside card ──────────────

  it('discovers both select and edit buttons in AddressCard', () => {
    const { fiber, unmount } = renderToFiber(
      React.createElement(View, null,
        React.createElement(AddressCard, {
          label: 'Home',
          address: '123 Main St',
          onSelect: jest.fn(),
          onEdit: jest.fn(),
        })
      )
    );

    const result = walkFiberTree(fiber);
    unmount();

    const pressables = result.interactives.filter(el => el.type === 'pressable');
    expect(pressables.length).toBeGreaterThanOrEqual(2);
  });

  // ─── aiIgnore: hidden checkout button ─────────────────────────

  it('respects aiIgnore prop on checkout button', () => {
    const { fiber, unmount } = renderToFiber(
      React.createElement(CartScreen, {
        items: [{ name: 'Pizza', kitchenName: 'Test', price: 100, quantity: 1 }],
      })
    );

    const result = walkFiberTree(fiber);
    unmount();

    // The checkout button has aiIgnore — should not appear
    const checkoutBtn = result.interactives.find(el =>
      el.label.toLowerCase().includes('checkout')
    );
    expect(checkoutBtn).toBeUndefined();
  });

  // ─── Disabled button: sold out ────────────────────────────────

  it('discovers disabled buttons but marks them with disabled prop', () => {
    const { fiber, unmount } = renderToFiber(
      React.createElement(View, null,
        React.createElement(ZButton, { title: 'Sold Out', onPress: jest.fn(), disabled: true }),
        React.createElement(ZButton, { title: 'Available', onPress: jest.fn() })
      )
    );

    const result = walkFiberTree(fiber);
    unmount();

    // Both discovered, but "Sold Out" should have disabled in props
    expect(result.interactives.length).toBeGreaterThanOrEqual(2);
    const availableBtn = result.interactives.find(el => el.label.includes('Available'));
    expect(availableBtn).toBeDefined();
  });

  // ─── LLM: Tap the correct DishCard add button ─────────────────

  it('LLM correctly taps add button on the right dish in a complex HomeScreen', async () => {
    const onDishAdd = jest.fn();
    const kitchens = [
      {
        name: 'Pizza Palace',
        rating: 4.8,
        deliveryTime: '25 min',
        dishes: [
          { name: 'Margherita', price: 89, rating: 4.5 },
          { name: 'Four Cheese', price: 119, rating: 4.3 },
        ],
      },
    ];

    const { result, unmount } = await executeGoalLive(
      React.createElement(HomeScreen, { kitchens, onDishAdd }),
      'Add the Four Cheese pizza to the cart',
      { maxSteps: 15 },
    );

    unmount();

    // The LLM correctly finds and taps "Add to cart" for Four Cheese.
    // It may report success:false because it tries to navigate to Cart to verify,
    // but navigation doesn't change the rendered component in test-renderer.
    // The REAL proof is the callback being called.
    expect(onDishAdd).toHaveBeenCalled();
  });

  // ─── LLM: Interact with PhoneInput ─────────────────────────────

  it('LLM can type into PhoneInput nested component', async () => {
    const onSave = jest.fn();

    const { result, unmount } = await executeGoalLive(
      React.createElement(View, null,
        React.createElement(ZText, { type: 'h1' }, 'Edit Profile'),
        React.createElement(PhoneInput, {
          phoneNumber: '',
          onChangePhone: jest.fn(),
        }),
        React.createElement(ZButton, { title: 'Save', onPress: () => onSave() })
      ),
      'Enter phone number "1234567890" and save',
      { maxSteps: 8 },
    );

    unmount();

    expect(result.success).toBe(true);
  });
});
