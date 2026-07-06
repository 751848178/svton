import { Injectable } from '@nestjs/common';

@Injectable()
export class MonitoringAlertSiteCertificateReaderService {
  asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  readString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  readBoolean(value: unknown) {
    return typeof value === 'boolean' ? value : undefined;
  }

  readCertificateExpiry(tls: Record<string, unknown>) {
    const candidates: Array<[string, unknown]> = [
      ['tls.expiresAt', tls.expiresAt],
      ['tls.notAfter', tls.notAfter],
      ['tls.certificateExpiresAt', tls.certificateExpiresAt],
      ['tls.certExpiresAt', tls.certExpiresAt],
    ];
    const certificate = this.asRecord(tls.certificate);
    const cert = this.asRecord(tls.cert);
    candidates.push(
      ['tls.certificate.expiresAt', certificate.expiresAt],
      ['tls.certificate.notAfter', certificate.notAfter],
      ['tls.cert.expiresAt', cert.expiresAt],
      ['tls.cert.notAfter', cert.notAfter],
    );

    for (const [source, value] of candidates) {
      const date = this.parseOptionalDate(value);
      if (date) {
        return {
          expiresAt: date,
          source,
          daysRemaining: Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
        };
      }
    }

    return null;
  }

  readCertificateMetadata(tls: Record<string, unknown>, key: string) {
    return (
      this.readString(tls[key]) ||
      this.readString(this.asRecord(tls.certificate)[key]) ||
      this.readString(this.asRecord(tls.cert)[key])
    );
  }

  readCertificateAssets(value: unknown) {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => this.asRecord(item))
      .filter((asset) => Boolean(this.readString(asset.id)))
      .map((asset) => ({
        id: this.readString(asset.id) || '',
        active: this.readBoolean(asset.active) === true,
        fingerprintSha256: this.readString(asset.fingerprintSha256),
        issuer: this.readString(asset.issuer),
        expiresAt: this.readString(asset.expiresAt),
      }));
  }

  parseOptionalDate(value: unknown) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value !== 'string' || !value.trim()) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
