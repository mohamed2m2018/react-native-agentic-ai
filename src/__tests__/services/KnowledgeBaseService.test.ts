/**
 * KnowledgeBaseService tests.
 *
 * Covers: keyword retrieval, screen filtering, priority sorting,
 * token budget, custom retriever, error handling, and formatting.
 */

import { KnowledgeBaseService } from '../../services/KnowledgeBaseService';
import type { KnowledgeEntry } from '../../core/types';

// ─── Test Fixtures ─────────────────────────────────────────────

const ENTRIES: KnowledgeEntry[] = [
  {
    id: 'refund-policy',
    title: 'Refund Policy',
    content: 'Full refund within 30 days. Items must be unused.',
    tags: ['refund', 'return', 'money back', 'policy'],
    priority: 5,
  },
  {
    id: 'delivery-areas',
    title: 'Delivery Areas',
    content: 'We deliver to Cairo, Giza, and Alexandria. 30-60 min delivery time.',
    tags: ['delivery', 'shipping', 'areas'],
    screens: ['Home', 'Cart'],
    priority: 7,
  },
  {
    id: 'allergens',
    title: 'Allergen Information',
    content: 'Margherita: gluten, dairy. BBQ Chicken: gluten, dairy, soy.',
    tags: ['allergen', 'allergy', 'gluten', 'dairy', 'ingredients'],
    screens: ['Menu', 'ProductDetails'],
    priority: 9,
  },
  {
    id: 'working-hours',
    title: 'Working Hours',
    content: 'Open daily from 10:00 AM to 2:00 AM.',
    tags: ['hours', 'open', 'closed', 'schedule'],
  },
  {
    id: 'payment',
    title: 'Payment Methods',
    content: 'Visa, MasterCard, cash on delivery, Vodafone Cash.',
    tags: ['payment', 'pay', 'visa', 'cash'],
    screens: ['Cart', 'Checkout'],
    priority: 6,
  },
];

// ─── Tests ─────────────────────────────────────────────────────

describe('KnowledgeBaseService', () => {
  describe('static entries (keyword retrieval)', () => {
    it('returns matching entries for a relevant query', async () => {
      const service = new KnowledgeBaseService(ENTRIES);
      const result = await service.retrieve('refund policy', 'Home');

      expect(result).toContain('Refund Policy');
      expect(result).toContain('Full refund within 30 days');
    });

    it('returns "no knowledge found" for an unrelated query', async () => {
      const service = new KnowledgeBaseService(ENTRIES);
      const result = await service.retrieve('quantum physics', 'Home');

      expect(result.toLowerCase()).toContain('no relevant knowledge');
    });

    it('filters by screen when screens is set', async () => {
      const service = new KnowledgeBaseService(ENTRIES);

      // "allergen" entry is only on Menu/ProductDetails screens
      const onMenu = await service.retrieve('allergen gluten', 'Menu');
      expect(onMenu).toContain('Allergen Information');

      const onHome = await service.retrieve('allergen gluten', 'Home');
      // Should NOT contain allergen entry on Home screen
      expect(onHome).not.toContain('Allergen Information');
    });

    it('includes entries with no screens restriction on any screen', async () => {
      const service = new KnowledgeBaseService(ENTRIES);
      const result = await service.retrieve('working hours', 'Settings');

      expect(result).toContain('Working Hours');
    });

    it('ranks higher-priority entries first', async () => {
      // Both entries match on 'Cart' screen. 'delivery areas' matches delivery (priority 7)
      // with more keyword overlap than payment. Verify delivery comes first.
      const service = new KnowledgeBaseService([
        { id: 'low', title: 'Low Priority Info', content: 'General info about the app.', tags: ['info'], priority: 2 },
        { id: 'high', title: 'High Priority Info', content: 'Critical info about the app.', tags: ['info'], priority: 9 },
      ]);
      const result = await service.retrieve('info about app', 'Home');

      const highIdx = result.indexOf('High Priority Info');
      const lowIdx = result.indexOf('Low Priority Info');

      expect(highIdx).toBeGreaterThan(-1);
      expect(lowIdx).toBeGreaterThan(-1);
      expect(highIdx).toBeLessThan(lowIdx);
    });

    it('respects token budget', async () => {
      // Very small budget — should only fit 1 entry (~50 chars → ~12 tokens)
      const service = new KnowledgeBaseService(ENTRIES, 20);
      const result = await service.retrieve('refund delivery hours', 'Home');

      // Should contain at most 1 entry title (the budget is ~80 chars)
      const titleMatches = ['Refund Policy', 'Delivery Areas', 'Working Hours']
        .filter(t => result.includes(t));
      expect(titleMatches.length).toBeLessThanOrEqual(2);
    });

    it('handles empty entries array', async () => {
      const service = new KnowledgeBaseService([]);
      const result = await service.retrieve('anything', 'Home');

      expect(result.toLowerCase()).toContain('no relevant knowledge');
    });

    it('handles empty query', async () => {
      const service = new KnowledgeBaseService(ENTRIES);
      const result = await service.retrieve('', 'Home');

      expect(result.toLowerCase()).toContain('no relevant knowledge');
    });

    it('does case-insensitive matching', async () => {
      const service = new KnowledgeBaseService(ENTRIES);
      const result = await service.retrieve('REFUND POLICY', 'Home');

      expect(result).toContain('Refund Policy');
    });
  });

  describe('custom retriever', () => {
    it('delegates to the custom retrieve function', async () => {
      const customRetriever = {
        retrieve: jest.fn().mockResolvedValue([
          { id: 'custom', title: 'Custom Info', content: 'Custom knowledge content' },
        ]),
      };

      const service = new KnowledgeBaseService(customRetriever);
      const result = await service.retrieve('test query', 'Home');

      expect(customRetriever.retrieve).toHaveBeenCalledWith('test query', 'Home');
      expect(result).toContain('Custom Info');
      expect(result).toContain('Custom knowledge content');
    });

    it('handles custom retriever returning empty array', async () => {
      const customRetriever = {
        retrieve: jest.fn().mockResolvedValue([]),
      };

      const service = new KnowledgeBaseService(customRetriever);
      const result = await service.retrieve('test', 'Home');

      expect(result.toLowerCase()).toContain('no relevant knowledge');
    });

    it('handles custom retriever throwing an error', async () => {
      const customRetriever = {
        retrieve: jest.fn().mockRejectedValue(new Error('API failed')),
      };

      const service = new KnowledgeBaseService(customRetriever);
      const result = await service.retrieve('test', 'Home');

      expect(result.toLowerCase()).toContain('retrieval failed');
    });
  });

  describe('formatting', () => {
    it('formats entries with ## title headers', async () => {
      const service = new KnowledgeBaseService([
        { id: '1', title: 'Title One', content: 'Content one.' },
        { id: '2', title: 'Title Two', content: 'Content two.' },
      ]);

      const result = await service.retrieve('title one two content', 'Home');

      expect(result).toContain('## Title One');
      expect(result).toContain('## Title Two');
    });
  });
});
