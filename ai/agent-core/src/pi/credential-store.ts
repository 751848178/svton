/**
 * Svton credential-store boundary for Pi (@earendil-works/pi-ai).
 *
 * Pi's `CredentialStore` is keyed by `provider.id` (one credential per
 * provider) and only ever stores a `Credential = ApiKeyCredential |
 * OAuthCredential`. Svton's preserved settings/config stores
 * (apps/agent-web settings-store, apps/agent-desktop config-store,
 * packages/agent-app provider-settings-store) currently surface a flat
 * `Record<providerType, apiKey>` map, so this adapter presents that map as a
 * Pi `CredentialStore`.
 *
 * PI001 scope: implement the interface against the injected map only. Wiring
 * to the live settings/config stores happens in a later slice.
 */
import type {
  ApiKeyCredential,
  Credential,
  CredentialInfo,
  CredentialStore,
} from '@earendil-works/pi-ai';

/**
 * Maps a svton provider-type key (e.g. `"openai"`, `"anthropic"`) to the
 * canonical Pi provider id. Today the keys already match Pi's known provider
 * ids, but normalizing here keeps the boundary explicit so the preserved
 * stores can keep their own naming without leaking it into Pi.
 */
function normalizeProviderId(providerType: string): string {
  return providerType.toLowerCase();
}

/** Build an `ApiKeyCredential` from a raw key string. */
function toApiKeyCredential(key: string): ApiKeyCredential {
  return { type: 'api_key', key };
}

/**
 * Pi `CredentialStore` backed by an injected `providerType -> apiKey` map.
 *
 * The map is the sole source of truth and is read-only; `modify`/`delete` are
 * best-effort no-ops because PI001 does not yet own credential writes. They
 * resolve consistently with Pi's documented error semantics (reject only on
 * storage failure, which a read-only view never has).
 */
export class SvtonPiCredentialStore implements CredentialStore {
  /**
   * @param apiKeys provider-type -> api key. Captured by reference so the
   *   backing store (settings/config store) can mutate it in place without
   *   rebuilding this adapter.
   */
  constructor(private readonly apiKeys: Record<string, string>) {}

  async read(providerId: string): Promise<Credential | undefined> {
    const key = this.apiKeys[normalizeProviderId(providerId)];
    return key ? toApiKeyCredential(key) : undefined;
  }

  async list(): Promise<readonly CredentialInfo[]> {
    // The injected map is a flat key/value record; exposing only configured
    // provider ids as non-secret metadata matches `CredentialInfo`'s contract.
    return Object.keys(this.apiKeys)
      .filter((id) => Boolean(this.apiKeys[id]))
      .map((id) => ({ providerId: normalizeProviderId(id), type: 'api_key' as const }));
  }

  async modify(
    providerId: string,
    fn: (current: Credential | undefined) => Promise<Credential | undefined>,
  ): Promise<Credential | undefined> {
    const id = normalizeProviderId(providerId);
    const raw = this.apiKeys[id];
    const current = raw ? toApiKeyCredential(raw) : undefined;
    // Run the caller's read-modify-write so observable ordering matches a real
    // store, but never persist — the injected map is the system of record.
    return fn(current);
  }

  async delete(providerId: string): Promise<void> {
    void normalizeProviderId(providerId);
  }
}
