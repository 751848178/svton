import { Injectable } from '@nestjs/common';
import type { AlertRuleRecord } from './monitoring-alert-rule.types';
import type { AlertEvaluationResult } from './monitoring-alert-evaluation.types';
import { MonitoringAlertEvaluationResultService } from './monitoring-alert-evaluation-result.service';
import { MonitoringAlertSiteCertificateReaderService } from './monitoring-alert-site-certificate-reader.service';
import { readPositiveInt } from './monitoring-number.utils';

@Injectable()
export class MonitoringAlertSiteCertificateExpiryEvaluationService {
  constructor(
    private readonly result: MonitoringAlertEvaluationResultService,
    private readonly reader: MonitoringAlertSiteCertificateReaderService,
  ) {}

  evaluate(rule: AlertRuleRecord): AlertEvaluationResult {
    const site = rule.site;
    if (!site) {
      return this.result.insufficient(rule, '规则未绑定站点目标', {});
    }

    const condition = this.reader.asRecord(rule.condition);
    const thresholdDays = readPositiveInt(condition.thresholdDays, 14, 1, 365);
    const tls = this.reader.asRecord(site.tls);
    const tlsType = this.reader.readString(tls.type) || 'unknown';
    const tlsEnabled = tls.enabled === true || (tlsType !== 'none' && tlsType !== 'unknown');
    const expiry = this.reader.readCertificateExpiry(tls);
    const value = {
      siteId: site.id,
      siteName: site.name,
      primaryDomain: site.primaryDomain,
      siteStatus: site.status,
      tlsEnabled,
      tlsType,
      thresholdDays,
      expiresAt: expiry?.expiresAt.toISOString() || null,
      expirySource: expiry?.source || null,
      daysRemaining: expiry?.daysRemaining ?? null,
      issuer: this.reader.readCertificateMetadata(tls, 'issuer'),
      serialNumber: this.reader.readCertificateMetadata(tls, 'serialNumber'),
      autoRenew:
        this.reader.readBoolean(tls.autoRenew) ??
        this.reader.readBoolean(this.reader.asRecord(tls.certificate).autoRenew),
    };

    if (!tlsEnabled) {
      return this.result.insufficient(rule, `站点 ${site.name} 未启用 TLS，无法评估证书过期`, value);
    }
    if (!expiry) {
      return this.result.insufficient(rule, `站点 ${site.name} 缺少证书过期时间`, value);
    }
    if (expiry.daysRemaining < 0) {
      return this.result.firing(rule, `站点 ${site.name} 证书已过期 ${Math.abs(expiry.daysRemaining)} 天`, value);
    }
    if (expiry.daysRemaining <= thresholdDays) {
      return this.result.firing(
        rule,
        `站点 ${site.name} 证书将在 ${expiry.daysRemaining} 天后过期，阈值 ${thresholdDays} 天`,
        value,
      );
    }
    return this.result.ok(rule, `站点 ${site.name} 证书还有 ${expiry.daysRemaining} 天过期`, value);
  }
}
