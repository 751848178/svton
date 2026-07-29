/** Provider families own authentication; API protocols own the wire format. */
export type PiProviderFamily = 'openai' | 'anthropic';

export type PiApiProtocol =
  | 'anthropic-messages'
  | 'openai-completions'
  | 'openai-responses';
export type PiOpenAIApiProtocol = Exclude<PiApiProtocol, 'anthropic-messages'>;

export const DEFAULT_BASE_URL: Record<PiProviderFamily, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
};

export const DEFAULT_API_BY_FAMILY: Record<PiProviderFamily, PiApiProtocol> = {
  openai: 'openai-responses',
  anthropic: 'anthropic-messages',
};

/** Backward-compatible name for callers that only need official defaults. */
export const FAMILY_API = DEFAULT_API_BY_FAMILY;

export interface PiApiProtocolOptions {
  family: PiProviderFamily;
  api?: PiApiProtocol;
  baseUrl?: string;
}

export function resolvePiApiProtocol(
  options: PiApiProtocolOptions,
): PiApiProtocol {
  if (options.family === 'anthropic') {
    assertCompatibleApi(options.family, options.api);
    return 'anthropic-messages';
  }
  assertCompatibleApi(options.family, options.api);
  if (options.api) return options.api;
  return isOfficialOpenAIUrl(options.baseUrl)
    ? 'openai-responses'
    : 'openai-completions';
}

export function resolvePiBaseUrl(options: PiApiProtocolOptions): string {
  const configured = trimTrailingSlashes(options.baseUrl);
  if (!configured) return DEFAULT_BASE_URL[options.family];
  if (options.family === 'openai' && isOfficialOpenAIUrl(configured)) {
    const parsed = new URL(configured);
    if (parsed.pathname === '/' || parsed.pathname === '') {
      parsed.pathname = '/v1';
    }
    return trimTrailingSlashes(parsed.toString());
  }
  return configured;
}

function isOfficialOpenAIUrl(baseUrl?: string): boolean {
  if (!baseUrl?.trim()) return true;
  try {
    return new URL(baseUrl).hostname.toLowerCase() === 'api.openai.com';
  } catch {
    return false;
  }
}

function assertCompatibleApi(
  family: PiProviderFamily,
  api?: PiApiProtocol,
): void {
  if (!api) return;
  const compatible = family === 'anthropic'
    ? api === 'anthropic-messages'
    : api === 'openai-completions' || api === 'openai-responses';
  if (!compatible) {
    throw new Error(`API protocol "${api}" is incompatible with ${family}`);
  }
}

function trimTrailingSlashes(url?: string): string {
  return url?.trim().replace(/\/+$/, '') ?? '';
}
