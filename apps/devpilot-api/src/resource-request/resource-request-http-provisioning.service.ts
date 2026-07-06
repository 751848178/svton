/**
 * HTTP (webhook / api) provisioning adapter.
 *
 * Creates a provisioning run, optionally queues it, then performs the HTTP
 * dispatch with bounded retry, redacted credential ref, idempotency key, and
 * delivery/credential splitting on success. Extracted verbatim from the
 * original `provisionWithHttpAdapter` in `ResourceRequestService`; the retry
 * loop body lives in `executeHttpProvisioningFetch` so this file stays under
 * the 200-line ceiling. No behavior change.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResourceRequestStatusWriterService } from './resource-request-status-writer.service';
import { ResourceProvisioningRunWriterService } from './resource-provisioning-run-writer.service';
import { ResourceRequestCredentialRefService } from './resource-request-credential-ref.service';
import {
  HttpProvisioningFetch,
  HttpProvisioningResponse,
  JsonRecord,
  ProvisioningMode,
  ProvisioningProcessorContext,
  ProvisioningResourceType,
  ResourceProvisioningRunRecord,
} from './resource-request.types';
import {
  asRecord,
  errorMessage,
  readBoolean,
  readPositiveInteger,
  readString,
} from './resource-provisioning-value.utils';
import {
  redactUrl,
} from './resource-provisioning-sensitive.utils';
import {
  buildProvisioningIdempotencyKey,
} from './resource-provisioning-http-config.utils';
import {
  isRetryableHttpStatus,
  readHttpMaxAttempts,
  readHttpRetryStatusCodes,
  readProvisioningQueueConfig,
} from './resource-provisioning-http-retry.utils';
import {
  buildExternalProvisioningPayload,
} from './resource-provisioning-http-request.utils';
import { buildHttpProvisioningCompletion } from './resource-http-provisioning-response.utils';
import {
  buildHttpAutoRetryMetadata,
} from './resource-provisioning-http-retry.utils';
import { executeHttpProvisioningFetch } from './resource-http-provisioning-fetch.utils';
@Injectable()
export class ResourceRequestHttpProvisioningService {
  constructor(
    private readonly statusWriter: ResourceRequestStatusWriterService,
    private readonly runWriter: ResourceProvisioningRunWriterService,
    private readonly credentialRef: ResourceRequestCredentialRefService,
    private readonly configService: ConfigService,
  ) {}

  private httpProvisioningEnabled() {
    return readBoolean(this.configService.get('RESOURCE_PROVISIONING_HTTP_ENABLED', false), false);
  }

  private httpProvisioningQueueEnabled() {
    return readBoolean(
      this.configService.get('RESOURCE_REQUEST_PROVISIONING_HTTP_QUEUE_ENABLED', false),
      false,
    );
  }

  async provisionWithHttpAdapter(
    teamId: string,
    userId: string | undefined,
    request: JsonRecord,
    resourceType: ProvisioningResourceType,
    mode: Extract<ProvisioningMode, 'webhook' | 'api'>,
    context: ProvisioningProcessorContext,
  ) {
    const provisioningConfig = asRecord(resourceType.provisioningConfig);
    const url = readString(provisioningConfig.url) || readString(provisioningConfig.endpoint);
    const method = (readString(provisioningConfig.method) || 'POST').toUpperCase();
    const idempotencyKey = buildProvisioningIdempotencyKey(request, resourceType, mode, provisioningConfig);
    const maxAttempts = readHttpMaxAttempts(provisioningConfig);
    const queueConfig = readProvisioningQueueConfig(
      provisioningConfig,
      this.httpProvisioningQueueEnabled(),
    );
    const provisioningRun = await this.runWriter.createProvisioningRun(
      teamId, userId, request, resourceType, mode, context, provisioningConfig,
      { method, url: url ? redactUrl(url) : undefined, idempotencyKey, maxAttempts, queue: queueConfig },
    );

    if (queueConfig.enabled && !context.forceInline) {
      return this.runWriter.markProvisioningQueuedWithRun(teamId, userId, request, {
        mode, method, url: url ? redactUrl(url) : undefined, idempotencyKey, queue: queueConfig,
      }, provisioningRun);
    }

    if (!url) {
      return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
        mode, status: 'blocked', boundary: 'http_adapter', idempotencyKey, reason: 'missing_url',
        blockedAt: new Date().toISOString(),
      }, provisioningRun);
    }
    if (!['POST', 'PUT', 'PATCH', 'GET'].includes(method)) {
      return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
        mode, status: 'blocked', boundary: 'http_adapter', method, url: redactUrl(url), idempotencyKey,
        reason: 'unsupported_method', blockedAt: new Date().toISOString(),
      }, provisioningRun);
    }

    let credentialRef;
    try {
      credentialRef = await this.credentialRef.resolveProvisioningCredentialRef(teamId, provisioningConfig);
    } catch (error) {
      return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
        mode, status: 'blocked', boundary: 'http_adapter', method, url: redactUrl(url), idempotencyKey,
        reason: errorMessage(error), blockedAt: new Date().toISOString(),
      }, provisioningRun);
    }
    await this.runWriter.attachProvisioningRunCredentialRef(provisioningRun, credentialRef);

    if (!this.httpProvisioningEnabled()) {
      return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
        mode, status: 'planned', boundary: 'http_adapter', method, url: redactUrl(url), idempotencyKey,
        credentialRef: credentialRef || undefined, reason: 'http_dispatch_disabled',
        requiresManualCompletion: true, plannedAt: new Date().toISOString(),
      }, provisioningRun);
    }

    const fetchFn = (globalThis as typeof globalThis & { fetch?: HttpProvisioningFetch }).fetch;
    if (!fetchFn) {
      return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
        mode, status: 'blocked', boundary: 'http_adapter', method, url: redactUrl(url), idempotencyKey,
        credentialRef: credentialRef || undefined, reason: 'fetch_unavailable',
        blockedAt: new Date().toISOString(),
      }, provisioningRun);
    }

    const timeoutMs = readPositiveInteger(provisioningConfig.timeoutMs) || 15000;
    const retryStatusCodes = readHttpRetryStatusCodes(provisioningConfig);
    const retryOnNetworkError = readBoolean(provisioningConfig.retryOnNetworkError, true);
    const requestPayload = buildExternalProvisioningPayload(request, resourceType, mode, credentialRef, idempotencyKey);
    const fetchResult = await executeHttpProvisioningFetch({
      fetchFn, url, method, requestPayload, provisioningConfig, idempotencyKey, credentialRef,
      maxAttempts, timeoutMs, retryStatusCodes, retryOnNetworkError,
    });

    return this.applyHttpFetchResult({
      teamId, userId, request, mode, context, resourceType, provisioningRun, url, method, idempotencyKey,
      credentialRef, provisioningConfig, retryStatusCodes, fetchResult,
    });
  }

  private async applyHttpFetchResult(input: {
    teamId: string; userId: string | undefined; request: JsonRecord;
    mode: Extract<ProvisioningMode, 'webhook' | 'api'>; context: ProvisioningProcessorContext;
    resourceType: ProvisioningResourceType; provisioningRun: ResourceProvisioningRunRecord;
    url: string; method: string; idempotencyKey: string; credentialRef: unknown;
    provisioningConfig: JsonRecord; retryStatusCodes: Set<number>;
    fetchResult: { response: HttpProvisioningResponse | null; responseBody: unknown; attempt: number };
  }) {
    const { teamId, userId, request, mode, context, resourceType, provisioningRun } = input;
    const { response, responseBody, attempt } = input.fetchResult;
    const maxAttempts = readHttpMaxAttempts(input.provisioningConfig);

    if (!response) {
      return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
        mode, status: 'blocked', boundary: 'http_adapter', method: input.method, url: redactUrl(input.url),
        idempotencyKey: input.idempotencyKey, credentialRef: input.credentialRef || undefined,
        reason: 'http_response_unavailable', retryable: false, attempt, maxAttempts,
        blockedAt: new Date().toISOString(),
      }, provisioningRun);
    }
    if (!response.ok) {
      const retryable = isRetryableHttpStatus(response.status, input.retryStatusCodes);
      const blockedAt = new Date();
      return this.runWriter.markProvisioningStatusWithRun(teamId, userId, request, {
        mode, status: 'blocked', boundary: 'http_adapter', method: input.method, url: redactUrl(input.url),
        idempotencyKey: input.idempotencyKey, credentialRef: input.credentialRef || undefined,
        httpStatus: response.status,
        reason: readString(asRecord(responseBody).message) || response.statusText || `http_${response.status}`,
        retryable, attempt, maxAttempts, attemptsExhausted: attempt >= maxAttempts,
        blockedAt: blockedAt.toISOString(),
        ...buildHttpAutoRetryMetadata(input.provisioningConfig, request, retryable, context, blockedAt),
      }, provisioningRun);
    }

    const { completedProvisioning, completionInput } = buildHttpProvisioningCompletion({
      response, responseBody, attempt, request, resourceType, mode, context, provisioningRun,
      url: input.url, method: input.method, idempotencyKey: input.idempotencyKey,
      credentialRef: input.credentialRef, provisioningConfig: input.provisioningConfig,
    });
    const completion = await this.statusWriter.completeProvisionedRequest(teamId, userId, request, completionInput);
    await this.runWriter.finishProvisioningRun(provisioningRun, completedProvisioning);
    return completion.request;
  }
}
