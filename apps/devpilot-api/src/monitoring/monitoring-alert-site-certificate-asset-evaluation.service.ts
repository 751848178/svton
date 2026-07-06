import { Injectable } from '@nestjs/common';
import type { AlertRuleRecord } from './monitoring-alert-rule.types';
import type { AlertEvaluationResult } from './monitoring-alert-evaluation.types';
import { MonitoringAlertEvaluationResultService } from './monitoring-alert-evaluation-result.service';
import { MonitoringAlertSiteCertificateReaderService } from './monitoring-alert-site-certificate-reader.service';
import { readPositiveInt } from './monitoring-number.utils';

@Injectable()
export class MonitoringAlertSiteCertificateAssetEvaluationService {
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
    const windowHours = readPositiveInt(condition.windowHours, 24, 1, 24 * 30);
    const includeFirstObservation = this.reader.readBoolean(condition.includeFirstObservation) === true;
    const tls = this.reader.asRecord(site.tls);
    const assets = this.reader.readCertificateAssets(tls.assets);
    const currentAssetId = this.reader.readString(tls.currentCertificateAssetId);
    const currentAsset = assets.find((asset) => asset.id === currentAssetId) || assets.find((asset) => asset.active);
    const previousAsset = assets.find((asset) => asset.id !== currentAsset?.id);
    const changedAt = this.reader.parseOptionalDate(tls.lastCertificateAssetChangedAt);
    const hoursSinceChange = changedAt ? Math.max(0, Math.floor((Date.now() - changedAt.getTime()) / 3600000)) : null;
    const value = {
      siteId: site.id,
      siteName: site.name,
      primaryDomain: site.primaryDomain,
      siteStatus: site.status,
      windowHours,
      includeFirstObservation,
      assetCount: assets.length,
      currentCertificateAssetId: currentAsset?.id || currentAssetId || null,
      previousCertificateAssetId: previousAsset?.id || null,
      changedAt: changedAt?.toISOString() || null,
      hoursSinceChange,
      currentFingerprint: currentAsset?.fingerprintSha256 || null,
      previousFingerprint: previousAsset?.fingerprintSha256 || null,
      currentIssuer: currentAsset?.issuer || null,
      previousIssuer: previousAsset?.issuer || null,
      currentExpiresAt: currentAsset?.expiresAt || null,
      previousExpiresAt: previousAsset?.expiresAt || null,
    };

    if (!assets.length || !currentAsset) {
      return this.result.insufficient(rule, `站点 ${site.name} 没有证书资产快照`, value);
    }
    if (assets.length < 2 && !includeFirstObservation) {
      return this.result.ok(rule, `站点 ${site.name} 只有首次证书资产快照，未发现证书变化`, value);
    }
    if (!changedAt) {
      return this.result.insufficient(rule, `站点 ${site.name} 缺少证书资产变化时间`, value);
    }
    if (hoursSinceChange !== null && hoursSinceChange <= windowHours) {
      return this.result.firing(rule, `站点 ${site.name} 证书资产在最近 ${hoursSinceChange} 小时内发生变化`, value);
    }
    return this.result.ok(rule, `站点 ${site.name} 最近 ${windowHours} 小时内未发现证书资产变化`, value);
  }
}
