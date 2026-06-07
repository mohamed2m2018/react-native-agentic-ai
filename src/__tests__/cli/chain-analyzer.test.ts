import { buildNavigationGraph, extractChains } from '../../cli/analyzers/chain-analyzer';

describe('chain analyzer', () => {
  it('builds deep navigation chains from direct route links', () => {
    const graph = buildNavigationGraph({
      Home: ['Profile'],
      Profile: ['SubscriptionManagement'],
      SubscriptionManagement: ['SubscriptionWorkspace'],
      SubscriptionWorkspace: ['SubscriptionControls'],
      SubscriptionControls: ['SubscriptionPause', 'SubscriptionCancellation'],
      SubscriptionPause: [],
      SubscriptionCancellation: [],
    });

    const chains = extractChains(graph, [
      'Home',
      'Profile',
      'SubscriptionManagement',
      'SubscriptionWorkspace',
      'SubscriptionControls',
      'SubscriptionPause',
      'SubscriptionCancellation',
    ]);

    expect(chains).toContainEqual([
      'Home',
      'Profile',
      'SubscriptionManagement',
      'SubscriptionWorkspace',
      'SubscriptionControls',
      'SubscriptionPause',
    ]);
    expect(chains).toContainEqual([
      'Home',
      'Profile',
      'SubscriptionManagement',
      'SubscriptionWorkspace',
      'SubscriptionControls',
      'SubscriptionCancellation',
    ]);
  });
});
