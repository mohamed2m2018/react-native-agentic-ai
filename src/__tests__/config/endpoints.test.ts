import { ENDPOINTS } from '../../config/endpoints';

describe('ENDPOINTS', () => {
  it('exposes hosted proxy defaults for MobileAI cloud', () => {
    expect(ENDPOINTS.hostedTextProxy).toBe('https://mobileai.cloud/api/v1/hosted-proxy/text');
    expect(ENDPOINTS.hostedVoiceProxy).toBe('wss://mobileai.cloud/ws/hosted-proxy/voice');
  });
});
