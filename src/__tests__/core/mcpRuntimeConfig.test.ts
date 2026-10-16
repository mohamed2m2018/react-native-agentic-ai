import {
  buildMCPRuntimeConfig,
  parseMCPProviderConfig,
} from '../../core/mcpRuntimeConfig';
import type { AgentConfig } from '../../core/types';

describe('mcpRuntimeConfig', () => {
  it('parses a valid provider config and trims values', () => {
    expect(
      parseMCPProviderConfig({ provider: 'gemini', apiKey: ' k ', model: ' ' })
    ).toEqual({
      provider: 'gemini',
      apiKey: 'k',
      model: undefined,
    });
  });

  it.each([null, {}, { provider: 'gemini' }, { provider: 'x', apiKey: 'k' }])(
    'rejects %p',
    (input) => {
      expect(parseMCPProviderConfig(input)).toBeNull();
    }
  );

  it('drops dashboard and support settings and keeps only developer props', () => {
    const devTool = {
      name: 'open_profile',
      description: 'd',
      parameters: {},
      execute: jest.fn(),
    } as any;
    const base: AgentConfig = {
      apiKey: 'app-key',
      model: 'app-model',
      proxyUrl: 'https://hosted.example/proxy',
      proxyHeaders: { Authorization: 'Bearer x' },
      voiceProxyUrl: 'wss://hosted.example/voice',
      supportStyle: 'warm-concise',
      allowedActionNames: ['remote_action'],
      customTools: { escalate_to_human: devTool, report_issue: devTool },
      maxSteps: 12,
    } as AgentConfig;

    const result = buildMCPRuntimeConfig(
      base,
      { provider: 'openai', apiKey: 'mcp-key', model: 'mcp-model' },
      { customTools: { open_profile: devTool } }
    );

    expect(result).toMatchObject({
      apiKey: 'mcp-key',
      model: 'mcp-model',
      maxSteps: 12,
    });
    expect(result.proxyUrl).toBeUndefined();
    expect(result.proxyHeaders).toBeUndefined();
    expect(result.voiceProxyUrl).toBeUndefined();
    expect(result.supportStyle).toBeUndefined();
    expect(result.allowedActionNames).toBeUndefined();
    expect(Object.keys(result.customTools ?? {})).toEqual(['open_profile']);
  });
});
