import { createMobileAIKnowledgeRetriever } from '../../services/MobileAIKnowledgeRetriever';

describe('createMobileAIKnowledgeRetriever', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('queries the dashboard knowledge endpoint with the publishable key', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        entries: [
          {
            id: 'doc-1',
            title: 'Refund Policy',
            content: 'Refunds within 30 days.',
          },
        ],
      }),
    } as any);

    const retriever = createMobileAIKnowledgeRetriever({
      analyticsKey: 'mobileai_pub_test',
      baseUrl: 'http://localhost:3001',
    });

    const entries = await retriever.retrieve('refund policy', 'Checkout');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/knowledge/query',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mobileai_pub_test',
        }),
      })
    );
    expect(entries).toEqual([
      {
        id: 'doc-1',
        title: 'Refund Policy',
        content: 'Refunds within 30 days.',
      },
    ]);
  });

  it('defaults to MobileAI cloud when no base url is provided', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ entries: [] }),
    } as any);

    const retriever = createMobileAIKnowledgeRetriever({
      analyticsKey: 'mobileai_pub_test',
    });

    await retriever.retrieve('refund policy', 'Checkout');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://mobileai.cloud/api/v1/knowledge/query',
      expect.any(Object)
    );
  });

  it('normalizes analytics ingest urls down to the project api base', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ entries: [] }),
    } as any);

    const retriever = createMobileAIKnowledgeRetriever({
      analyticsKey: 'mobileai_pub_test',
      baseUrl: 'https://app.mobileai.cloud/api/v1/analytics',
    });

    await retriever.retrieve('shipping', 'Home');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://app.mobileai.cloud/api/v1/knowledge/query',
      expect.any(Object)
    );
  });
});
