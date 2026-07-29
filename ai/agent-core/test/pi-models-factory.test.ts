import { describe, expect, it } from 'vitest';
import {
  createPiModelsForProvider,
  resolvePiApiProtocol,
  resolvePiBaseUrl,
} from '../src/pi';

describe('Pi provider API protocol routing', () => {
  it('routes DeepSeek through Chat Completions without changing its base URL', () => {
    const handle = createPiModelsForProvider('deepseek-v4-pro', {
      family: 'openai',
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'test-key',
    });

    expect(handle.model.api).toBe('openai-completions');
    expect(handle.model.baseUrl).toBe('https://api.deepseek.com');
  });

  it('routes official OpenAI through Responses and normalizes the default /v1 path', () => {
    const options = {
      family: 'openai' as const,
      baseUrl: 'https://api.openai.com/',
    };

    expect(resolvePiApiProtocol(options)).toBe('openai-responses');
    expect(resolvePiBaseUrl(options)).toBe('https://api.openai.com/v1');
    expect(createPiModelsForProvider('custom-openai-model', options).model.api)
      .toBe('openai-responses');
  });

  it('keeps Anthropic on the Messages protocol', () => {
    const handle = createPiModelsForProvider('custom-claude', {
      family: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
    });

    expect(handle.model.api).toBe('anthropic-messages');
    expect(handle.model.baseUrl).toBe('https://api.anthropic.com');
  });

  it('defaults custom OpenAI-compatible endpoints to Chat Completions', () => {
    const handle = createPiModelsForProvider('custom-model', {
      family: 'openai',
      baseUrl: 'https://llm.example.com/v1',
    });

    expect(handle.model.api).toBe('openai-completions');
    expect(handle.model.baseUrl).toBe('https://llm.example.com/v1');
  });

  it('honors an explicit Responses protocol for a custom endpoint', () => {
    const handle = createPiModelsForProvider('custom-model', {
      family: 'openai',
      api: 'openai-responses',
      baseUrl: 'https://responses.example.com/v1',
    });

    expect(handle.model.api).toBe('openai-responses');
  });

  it('rejects protocols that do not match the authentication family', () => {
    expect(() => resolvePiApiProtocol({
      family: 'anthropic',
      api: 'openai-completions',
    })).toThrow(/incompatible/);
  });
});
