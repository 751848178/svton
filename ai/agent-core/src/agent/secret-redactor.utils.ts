/**
 * Secret redaction for tool results (Architecture §5.3 svton-owned:
 * "result redaction and audit metadata").
 *
 * The previous default redactor was an identity no-op — a seam — which let raw
 * secrets (API keys, bearer tokens, AWS credentials, private keys) flow from
 * tool output straight into the model transcript and audit log. This module
 * provides the real scrubber that is now installed by default on
 * `ToolExecutionService`.
 *
 * Design:
 * - Pattern-based (regex) detection of common high-signal secret shapes. This
 *   is deliberately conservative: it targets well-structured credential
 *   formats with low false-positive risk (key prefixes, jwt structure, pem
 *   headers), not arbitrary long hex strings.
 * - Replacements are a fixed sentinel (`[REDACTED:<kind>]`) so the model still
 *   sees that a value existed and what kind it was, without the secret itself.
 * - Idempotent: redacting an already-redacted string is a no-op.
 * - Never throws; on any error the input is returned unchanged (the executor
 *   additionally wraps the call in try/catch).
 */
import type { ToolCall, ToolResult } from '../tool/types';
import type { Redactor } from './tool-executor';

/** Sentinel inserted in place of a detected secret. */
export const REDACTED = '[REDACTED';

/** A compiled secret pattern. `kind` labels the replacement sentinel. */
interface SecretPattern {
  kind: string;
  /** Matched against the tool-result output. */
  regex: RegExp;
  /**
   * When set, only the captured group at this 1-based index is replaced (the
   * surrounding label/context is preserved). When omitted, the whole match is
   * replaced. Use a capture group for "label: <secret>" shapes so the model
   * still sees which field held the secret.
   */
  valueGroup?: number;
}

/**
 * Ordered secret patterns. Order matters only for sentinel labels; matches are
 * independent. Value-grouped patterns preserve the label and replace only the
 * secret value; whole-match patterns replace the entire secret shape.
 */
const SECRET_PATTERNS: readonly SecretPattern[] = [
  // AWS access key id (20 uppercase alphanumerics, historically AKIA-prefixed).
  { kind: 'aws-key', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  // AWS secret access key (40 base64-ish chars) following an assignment label.
  { kind: 'aws-secret', regex: /\b(aws_secret_access_key|aws_secret|secret_key|secretAccessKey)["'\s:=]+([A-Za-z0-9/+=]{40})\b/g, valueGroup: 2 },
  // Generic "Authorization: Bearer <token>".
  { kind: 'bearer', regex: /\b(Bearer|bearer)\s+([A-Za-z0-9\-._~+/]+=*)/g, valueGroup: 2 },
  // GitHub personal access token (classic ghp_ / github_pat_ / gho_ / ghs_).
  { kind: 'github-token', regex: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  // Slack token (xoxb-/xoxp-/xoxa-).
  { kind: 'slack-token', regex: /\bxox[abp]-[A-Za-z0-9-]{10,}\b/g },
  // Stripe live/secret key (sk_live_, rk_live_, sk_test_).
  { kind: 'stripe-key', regex: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  // Google API key (AIza...).
  { kind: 'google-api-key', regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g },
  // JWT (three base64url segments).
  { kind: 'jwt', regex: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  // PEM private key block (header through footer, multiline).
  { kind: 'private-key', regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/g },
  // Generic api_key / apikey / access_token / secret assignment with a long value.
  { kind: 'api-key', regex: /\b(api[_-]?key|apikey|access[_-]?token|client[_-]?secret|private[_-]?key)["'\s:=]+([A-Za-z0-9_\-]{20,})\b/g, valueGroup: 2 },
];

/**
 * Scrub detected secrets from `text`, replacing each with `[REDACTED:<kind>]`.
 * Returns the original text if no secrets are found. Idempotent. For "label:
 * <secret>" shapes the label is preserved and only the value is replaced.
 */
export function redactSecrets(text: string): string {
  if (!text || typeof text !== 'string') return text;
  let out = text;
  for (const { kind, regex, valueGroup } of SECRET_PATTERNS) {
    if (valueGroup) {
      out = out.replace(regex, (...args) => {
        const full = args[0] as string;
        const value = args[valueGroup] as string;
        return full.slice(0, full.indexOf(value)) + `[REDACTED:${kind}]` + full.slice(full.indexOf(value) + value.length);
      });
    } else {
      out = out.replace(regex, () => `[REDACTED:${kind}]`);
    }
  }
  return out;
}

/**
 * Build a `Redactor` that scrubs secrets from a `ToolResult.output` string.
 * The returned redactor copies the result so the caller's object is untouched,
 * and preserves `isError`/`callId`/`metadata`. Never throws.
 */
export function createSecretRedactor(): Redactor {
  return (_call: ToolCall, result: ToolResult): ToolResult => {
    const scrubbed = redactSecrets(result.output);
    if (scrubbed === result.output) return result;
    return { ...result, output: scrubbed };
  };
}

export { REDACTED as _redactedSentinel };
