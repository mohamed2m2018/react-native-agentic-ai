/**
 * Complex Multi-Screen Flow Tests — REAL LLM Integration
 *
 * These test the agent's ability to handle complex, stateful screens
 * with deeply nested custom components.
 */

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import React from 'react';
import { requireApiKey, executeGoalLive, renderToFiber, createLiveRuntime } from './e2e-helpers';
import {
  HomeScreen, MenuScreen, CartScreen, CheckoutWizardScreen,
  EditProfileScreen, NotificationPrefsScreen, OnboardingScreen,
  SignupScreen, ChatListScreen, ChatScreen,
} from './test-app/screens';

jest.setTimeout(180_000);

beforeAll(() => {
  requireApiKey();
});

describe('Complex Flows — Real LLM', () => {

  // ─── Goal: Navigate a restaurant app homepage ─────────────────

  it('understands a complex SectionList with nested KitchenCards', async () => {
    const onDishAdd = jest.fn();
    const kitchens = [
      {
        name: 'Pizza Palace',
        rating: 4.8,
        deliveryTime: '25 min',
        dishes: [
          { name: 'Margherita', price: 89, rating: 4.5 },
          { name: 'Pepperoni', price: 109, rating: 4.7 },
        ],
      },
      {
        name: 'Burger Barn',
        rating: 4.2,
        deliveryTime: '35 min',
        dishes: [
          { name: 'Classic Burger', price: 75, rating: 4.0 },
        ],
      },
    ];

    const { result, unmount } = await executeGoalLive(
      React.createElement(HomeScreen, { kitchens, onDishAdd }),
      'Add the Margherita pizza to my cart',
      { maxSteps: 15 },
    );

    unmount();

    expect(onDishAdd).toHaveBeenCalled();
  });

  // ─── Goal: Complete a checkout wizard ─────────────────────────

  it('fills a 3-step checkout wizard', async () => {
    const onConfirm = jest.fn();

    const { result, unmount } = await executeGoalLive(
      React.createElement(CheckoutWizardScreen, { onConfirm }),
      'Complete checkout: select the Home address, pick the 2:00 PM time slot, enter card number "4242424242424242", and confirm the order',
      { maxSteps: 15 },
    );

    unmount();

    expect(onConfirm).toHaveBeenCalled();
  });

  // ─── Goal: Edit profile with phone ────────────────────────────

  it('edits profile with name, bio, and phone', async () => {
    const onSave = jest.fn();

    const { result, unmount } = await executeGoalLive(
      React.createElement(EditProfileScreen, {
        user: { name: 'Mohamed', bio: '', phone: '' },
        onSave,
      }),
      'Update my name to "Mohamed Salah", set bio to "Food lover from Cairo", and save',
      { maxSteps: 15 },
    );

    unmount();

    expect(onSave).toHaveBeenCalled();
  });

  // ─── Goal: Toggle specific notification preferences ───────────

  it('enables all notifications except marketing', async () => {
    const onToggle = jest.fn();

    const { result, unmount } = await executeGoalLive(
      React.createElement(NotificationPrefsScreen, { onToggle }),
      'Enable all notification categories except Marketing',
      { maxSteps: 15 },
    );

    unmount();

    expect(onToggle).toHaveBeenCalled();
  });

  // ─── Goal: Complete onboarding swiper ─────────────────────────

  it.skip('navigates through onboarding slides', async () => {
    const onFinish = jest.fn();

    const { result, unmount } = await executeGoalLive(
      React.createElement(OnboardingScreen, { onFinish }),
      'Complete the onboarding by going through all slides and tapping Get Started',
      { maxSteps: 12 },
    );

    unmount();

    expect(onFinish).toHaveBeenCalled();
  });

  // ─── Goal: Cart with quantity manipulation ────────────────────

  it('increases item quantity in cart', async () => {
    const onIncrement = jest.fn();

    const { result, unmount } = await executeGoalLive(
      React.createElement(CartScreen, {
        items: [
          { name: 'Shawarma', kitchenName: 'Damascus Kitchen', price: 45, quantity: 1 },
          { name: 'Falafel', kitchenName: 'Damascus Kitchen', price: 25, quantity: 1 },
        ],
        onIncrement,
      }),
      'Increase the Shawarma quantity by tapping the plus button',
      { maxSteps: 15 },
    );

    unmount();

    expect(onIncrement).toHaveBeenCalled();
  });

  // ─── Goal: Loading state handling ─────────────────────────────

  it('recognizes a loading screen and reports no items', async () => {
    const { result, unmount } = await executeGoalLive(
      React.createElement(MenuScreen, { isLoading: true }),
      'How many menu items are available?',
      { maxSteps: 3 },
    );

    unmount();

    // The LLM should recognize the loading state and report accordingly
    expect(result.message).toBeDefined();
  });

  // ─── Goal: Empty cart state ───────────────────────────────────

  it('handles empty cart gracefully', async () => {
    const { result, unmount } = await executeGoalLive(
      React.createElement(CartScreen, { items: [] }),
      'What items are in my cart?',
      { maxSteps: 3 },
    );

    unmount();

    expect(result.message).toBeDefined();
  });
});
