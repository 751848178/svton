/**
 * HTTP provisioning fetch retry-loop helper.
 *
 * Extracted verbatim from the original `provisionWithHttpAdapter` retry loop
 * in `ResourceRequestService`, so the HTTP adapter service stays under the
 * 200-line ceiling. Performs the bounded-retry HTTP dispatch with abort
 * timeout, retryable-status / network-error handling, and response body
 * parsing. Returns the final response (null on persistent failure), the
 * parsed body, and the attempt count. No behavior change.
 */

import {
  HttpProvisioningFetch,
  HttpProvisioningResponse,
  JsonRecord,
} from './resource-request.types';
import {
  buildHttpProvisioningHeaders,
  readHttpProvisioningBody,
} from './resource-provisioning-http-request.utils';
import { isRetryableHttpStatus } from './resource-provisioning-http-retry.utils';

export async function executeHttpProvisioningFetch(input: {
  fetchFn: HttpProvisioningFetch;
  url: string;
  method: string;
  requestPayload: unknown;
  provisioningConfig: JsonRecord;
  idempotencyKey: string;
  credentialRef: unknown;
  maxAttempts: number;
  timeoutMs: number;
  retryStatusCodes: Set<number>;
  retryOnNetworkError: boolean;
}): Promise<{ response: HttpProvisioningResponse | null; responseBody: unknown; attempt: number }> {
  const { fetchFn, url, method, requestPayload, provisioningConfig, idempotencyKey, credentialRef } = input;
  let response: HttpProvisioningResponse | null = null;
  let responseBody: unknown = {};
  let attempt = 0;

  for (attempt = 1; attempt <= input.maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

    try {
      response = await fetchFn(url, {
        method,
        headers: buildHttpProvisioningHeaders(provisioningConfig, idempotencyKey, credentialRef as any),
        body: method === 'GET' ? undefined : JSON.stringify(requestPayload),
        signal: controller.signal,
      });
      responseBody = await readHttpProvisioningBody(response);

      if (
        response.ok
        || !isRetryableHttpStatus(response.status, input.retryStatusCodes)
        || attempt >= input.maxAttempts
      ) {
        break;
      }
    } catch {
      if (!input.retryOnNetworkError || attempt >= input.maxAttempts) {
        break;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return { response, responseBody, attempt };
}
