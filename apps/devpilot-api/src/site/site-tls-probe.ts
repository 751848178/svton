import { Prisma } from '@prisma/client';
import {
  collectText,
  isRecord,
  parseOpenSslCertificateText,
  parseOpenSslDate,
  readNumber,
  readString,
} from './site-tls-openssl-parser.utils';

type JsonRecord = Record<string, unknown>;

export type SiteTlsProbeMetadata = {
  enabled: true;
  type: string;
  source: 'openssl_s_client';
  probeHost: string;
  probePort: number;
  probedAt: string;
  subject?: string;
  issuer?: string;
  serialNumber?: string;
  notBefore?: string;
  notAfter: string;
  expiresAt: string;
  fingerprintSha256?: string;
  daysRemaining: number;
  certificate: {
    source: 'openssl_s_client';
    probeHost: string;
    probePort: number;
    probedAt: string;
    subject?: string;
    issuer?: string;
    serialNumber?: string;
    notBefore?: string;
    notAfter: string;
    expiresAt: string;
    fingerprintSha256?: string;
    daysRemaining: number;
  };
};

export type SiteTlsCertificateAssetSnapshot = {
  id: string; kind: 'observed_tls_certificate'; source: 'openssl_s_client'; managed: false; active: boolean;
  probeHost: string; probePort: number; firstSeenAt: string; lastSeenAt: string; observationCount: number;
  subject?: string; issuer?: string; serialNumber?: string; notBefore?: string;
  notAfter: string; expiresAt: string; fingerprintSha256?: string; daysRemaining: number;
};

export function buildSiteTlsProbeCommand(host: string, port = 443) {
  return `echo | openssl s_client -servername ${host} -connect ${host}:${port} 2>/dev/null | openssl x509 -noout -subject -issuer -serial -dates -fingerprint -sha256`;
}

export function extractSiteTlsProbeMetadata(input: {
  host: string;
  port?: number;
  result?: unknown;
  logs?: unknown;
  now?: Date;
  currentType?: string;
}): SiteTlsProbeMetadata | null {
  const textChunks: string[] = [];
  collectText(input.result, textChunks);
  collectText(input.logs, textChunks);
  const parsed = parseOpenSslCertificateText(textChunks.join('\n'));
  const notAfter = parseOpenSslDate(parsed.notAfter);

  if (!notAfter) {
    return null;
  }

  const now = input.now || new Date();
  const probedAt = now.toISOString();
  const notBefore = parseOpenSslDate(parsed.notBefore);
  const expiresAt = notAfter.toISOString();
  const daysRemaining = Math.ceil((notAfter.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  const type = input.currentType && input.currentType !== 'none' ? input.currentType : 'observed';
  const base = {
    source: 'openssl_s_client' as const,
    probeHost: input.host,
    probePort: input.port || 443,
    probedAt,
    subject: parsed.subject,
    issuer: parsed.issuer,
    serialNumber: parsed.serialNumber,
    notBefore: notBefore?.toISOString(),
    notAfter: expiresAt,
    expiresAt,
    fingerprintSha256: parsed.fingerprintSha256,
    daysRemaining,
  };

  return {
    enabled: true,
    type,
    ...base,
    certificate: base,
  };
}

export function mergeSiteTlsProbeMetadata(
  currentTls: unknown,
  metadata: SiteTlsProbeMetadata,
): Prisma.InputJsonValue {
  const current = isRecord(currentTls) ? currentTls : {};
  const currentCertificate = isRecord(current.certificate) ? current.certificate : {};
  const certificateAssetId = buildCertificateAssetId(metadata);
  const currentCertificateAssetId = readString(current.currentCertificateAssetId);
  const lastCertificateAssetChangedAt = currentCertificateAssetId && currentCertificateAssetId === certificateAssetId
    ? readString(current.lastCertificateAssetChangedAt) || metadata.probedAt
    : metadata.probedAt;
  const assets = mergeCertificateAssets(current.assets, metadata, certificateAssetId);

  return toJsonValue({
    ...current,
    enabled: true,
    type: metadata.type,
    source: metadata.source,
    probeHost: metadata.probeHost,
    probePort: metadata.probePort,
    probedAt: metadata.probedAt,
    lastProbedAt: metadata.probedAt,
    subject: metadata.subject,
    issuer: metadata.issuer,
    serialNumber: metadata.serialNumber,
    notBefore: metadata.notBefore,
    notAfter: metadata.notAfter,
    expiresAt: metadata.expiresAt,
    fingerprintSha256: metadata.fingerprintSha256,
    daysRemaining: metadata.daysRemaining,
    certificate: {
      ...currentCertificate,
      ...metadata.certificate,
    },
    currentCertificateAssetId: certificateAssetId,
    lastCertificateAssetSeenAt: metadata.probedAt,
    lastCertificateAssetChangedAt,
    certificateAssetCount: assets.length,
    assets,
  });
}

function mergeCertificateAssets(
  currentAssetsValue: unknown,
  metadata: SiteTlsProbeMetadata,
  certificateAssetId: string,
) {
  const currentAssets = readAssetArray(currentAssetsValue);
  const existing = currentAssets.find((asset) => readString(asset.id) === certificateAssetId);
  const existingObservationCount = readNumber(existing?.observationCount) || 0;
  const nextAsset: SiteTlsCertificateAssetSnapshot = {
    id: certificateAssetId,
    kind: 'observed_tls_certificate',
    source: metadata.source,
    managed: false,
    active: true,
    probeHost: metadata.probeHost,
    probePort: metadata.probePort,
    firstSeenAt: readString(existing?.firstSeenAt) || metadata.probedAt,
    lastSeenAt: metadata.probedAt,
    observationCount: existingObservationCount + 1,
    subject: metadata.subject,
    issuer: metadata.issuer,
    serialNumber: metadata.serialNumber,
    notBefore: metadata.notBefore,
    notAfter: metadata.notAfter,
    expiresAt: metadata.expiresAt,
    fingerprintSha256: metadata.fingerprintSha256,
    daysRemaining: metadata.daysRemaining,
  };
  const inactiveAssets = currentAssets
    .filter((asset) => readString(asset.id) !== certificateAssetId)
    .map((asset) => ({ ...asset, active: false }));

  return [nextAsset, ...inactiveAssets].slice(0, 10);
}

function readAssetArray(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is JsonRecord => isRecord(item) && typeof item.id === 'string');
}

function buildCertificateAssetId(metadata: SiteTlsProbeMetadata) {
  const fingerprint = metadata.fingerprintSha256?.replace(/\s+/g, '').toUpperCase();
  if (fingerprint) return `sha256:${fingerprint}`;
  const serial = metadata.serialNumber?.replace(/\s+/g, '').toUpperCase();
  if (serial) return `serial:${serial}`;
  return `observed:${metadata.probeHost}:${metadata.expiresAt}`;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
