/**
 * Full Pipeline E2E Tests — REAL LLM Integration
 *
 * Each test renders real RN components, gives the REAL Gemini LLM
 * a goal, and verifies the OUTCOME (callbacks fired, state changed).
 *
 * Key insight: The LLM may report success:false because the test
 * renderer doesn't re-render like a real device. The TRUE test is
 * whether the correct callback was invoked with the right arguments.
 */

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import React from 'react';
import { requireApiKey, executeGoalLive } from './e2e-helpers';
import {
  LoginScreen, SearchScreen, DishDetailScreen, WriteReviewScreen,
  SettingsScreen, CartScreen, ChatScreen,
} from './test-app/screens';

// Real API calls take a few seconds per step
jest.setTimeout(120_000);

beforeAll(() => {
  requireApiKey();
});

describe('Full Pipeline — Real LLM', () => {

  // ─── Goal: Log in with email and password ─────────────────────

  it('logs in with email and password when asked', async () => {
    const onLogin = jest.fn();

    const { result, unmount } = await executeGoalLive(
      React.createElement(LoginScreen, { onLogin }),
      'Log in with email "chef@feedyum.com" and password "mypassword123"',
      { maxSteps: 15 },
    );

    unmount();

    // The real E2E proof: did the library wire the LLM's actions to the callback?
    expect(onLogin).toHaveBeenCalled();
    const [email, password] = onLogin.mock.calls[0] || [];
    expect(email).toBe('chef@feedyum.com');
    expect(password).toBe('mypassword123');
  });

  // ─── Goal: Search for a dish ──────────────────────────────────

  it('searches for a dish when asked', async () => {
    const onSearch = jest.fn();

    const { result, unmount } = await executeGoalLive(
      React.createElement(SearchScreen, {
        categories: ['Pizza', 'Pasta', 'Salads'],
        recentSearches: ['Shawarma'],
        onSearch,
      }),
      'Search for "Margherita Pizza"',
      { maxSteps: 15 },
    );

    unmount();

    // LLM should have typed and tapped search, or tapped a recent search
    expect(onSearch).toHaveBeenCalled();
  });

  // ─── Goal: Add dish to cart ───────────────────────────────────

  it('adds a dish to cart from detail screen', async () => {
    const onAddToCart = jest.fn();

    const { result, unmount } = await executeGoalLive(
      React.createElement(DishDetailScreen, {
        dish: {
          name: 'Pepperoni Pizza',
          description: 'Classic pepperoni with mozzarella',
          price: 120,
          rating: 4.5,
        },
        onAddToCart,
      }),
      'Add this dish to my cart',
      { maxSteps: 15 },
    );

    unmount();

    // The callback should have been invoked
    expect(onAddToCart).toHaveBeenCalled();
  });

  // ─── Goal: Write a review with rating ─────────────────────────

  it('writes a review with star rating', async () => {
    const onSubmitReview = jest.fn();

    const { result, unmount } = await executeGoalLive(
      React.createElement(WriteReviewScreen, {
        dishName: 'Shawarma Plate',
        onSubmitReview,
      }),
      'Rate this dish 4 stars and write "Amazing shawarma, highly recommend!"',
      { maxSteps: 15 },
    );

    unmount();

    expect(onSubmitReview).toHaveBeenCalled();
    const reviewData = onSubmitReview.mock.calls[0]?.[0];
    expect(reviewData?.rating).toBe(4);
    expect(reviewData?.text).toContain('shawarma');
  });

  // ─── Goal: Toggle settings ───────────────────────────────────

  it('enables dark mode when asked', async () => {
    const onToggle = jest.fn();

    const { result, unmount } = await executeGoalLive(
      React.createElement(SettingsScreen, { onToggle }),
      'Turn on dark mode',
      { maxSteps: 15 },
    );

    unmount();

    expect(onToggle).toHaveBeenCalled();
    const darkModeCall = onToggle.mock.calls.find(
      (call: any[]) => call[0] === 'darkMode'
    );
    expect(darkModeCall).toBeDefined();
    expect(darkModeCall?.[1]).toBe(true);
  });

  // ─── Goal: Send a chat message ────────────────────────────────

  it('sends a chat message', async () => {
    const onSendMessage = jest.fn();

    const { result, unmount } = await executeGoalLive(
      React.createElement(ChatScreen, {
        messages: [
          { sender: 'Chef Ahmed', text: 'Your order is being prepared!' },
          { sender: 'You', text: 'Thanks! How long will it take?' },
        ],
        onSendMessage,
      }),
      'Send a message saying "Where is my order?"',
      { maxSteps: 15 },
    );

    unmount();

    // LLM should have typed the message and tapped Send
    expect(onSendMessage).toHaveBeenCalled();
  });

  // ─── Goal: Apply a promo code ─────────────────────────────────

  it('applies a promo code to cart', async () => {
    const onApplyPromo = jest.fn();

    const { result, unmount } = await executeGoalLive(
      React.createElement(CartScreen, {
        items: [
          { name: 'Margherita Pizza', kitchenName: 'Pizza Express', price: 120, quantity: 2 },
        ],
        onApplyPromo,
      }),
      'Apply promo code "SAVE20" to my order',
      { maxSteps: 15 },
    );

    unmount();

    expect(onApplyPromo).toHaveBeenCalled();
  });
});
