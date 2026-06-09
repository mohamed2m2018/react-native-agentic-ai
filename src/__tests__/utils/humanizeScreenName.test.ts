import { humanizeScreenName } from '../../utils/humanizeScreenName';

describe('humanizeScreenName', () => {
  describe('Expo Router file-based patterns', () => {
    it('handles root index', () => {
      expect(humanizeScreenName('index')).toBe('Home');
    });

    it('strips group routes', () => {
      expect(humanizeScreenName('(tabs)/index')).toBe('Home');
      expect(humanizeScreenName('(auth)/login')).toBe('Login');
      expect(humanizeScreenName('(app)/(tabs)/profile')).toBe('Profile');
    });

    it('skips layout routes', () => {
      expect(humanizeScreenName('_layout')).toBe('');
      expect(humanizeScreenName('(tabs)/_layout')).toBe('');
    });

    it('skips catch-all routes', () => {
      expect(humanizeScreenName('[...missing]')).toBe('');
      expect(humanizeScreenName('[...slug]')).toBe('');
    });

    it('strips dynamic brackets', () => {
      expect(humanizeScreenName('[id]')).toBe('Id');
      expect(humanizeScreenName('users/[userId]')).toBe('Users User Id');
    });

    it('handles nested indexes', () => {
      expect(humanizeScreenName('settings/index')).toBe('Settings');
    });
  });

  describe('React Navigation patterns (PascalCase)', () => {
    it('splits PascalCase', () => {
      expect(humanizeScreenName('ProductDetails')).toBe('Product Details');
      expect(humanizeScreenName('UserProfileEdit')).toBe('User Profile Edit');
    });

    it('keeps already humanized names clean', () => {
      expect(humanizeScreenName('Home')).toBe('Home');
      expect(humanizeScreenName('Settings')).toBe('Settings');
    });
  });

  describe('Formatting boundaries', () => {
    it('splits kebab-case', () => {
      expect(humanizeScreenName('product-details')).toBe('Product Details');
    });

    it('splits snake_case', () => {
      expect(humanizeScreenName('order_history')).toBe('Order History');
    });

    it('title cases all words', () => {
      expect(humanizeScreenName('my-awesome-screen')).toBe('My Awesome Screen');
    });

    it('handles null/undefined/empty gracefully', () => {
      expect(humanizeScreenName(null)).toBe('');
      expect(humanizeScreenName(undefined)).toBe('');
      expect(humanizeScreenName('')).toBe('');
    });
  });
});
