import { ENDPOINTS } from '../../config/endpoints';

describe('ENDPOINTS', () => {
  it('exposes hosted proxy defaults for Twomilia cloud', () => {
    expect(ENDPOINTS.hostedTextProxy).toBe('https://twomilia.com/api/v1/hosted-proxy/text');
    expect(ENDPOINTS.hostedVoiceProxy).toBe('wss://twomilia.com/ws/hosted-proxy/voice');
  });
});
