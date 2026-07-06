import { Injectable } from '@nestjs/common';
import type { AlertRuleRecord } from './monitoring-alert-rule.types';
import type { AlertEvaluationResult } from './monitoring-alert-evaluation.types';
import { MonitoringAlertSiteCertificateAssetEvaluationService } from './monitoring-alert-site-certificate-asset-evaluation.service';
import { MonitoringAlertSiteCertificateExpiryEvaluationService } from './monitoring-alert-site-certificate-expiry-evaluation.service';
import { MonitoringAlertSiteTlsRenewalEvaluationService } from './monitoring-alert-site-tls-renewal-evaluation.service';

@Injectable()
export class MonitoringAlertSiteCertificateEvaluationService {
  constructor(
    private readonly certificateExpiry: MonitoringAlertSiteCertificateExpiryEvaluationService,
    private readonly certificateAsset: MonitoringAlertSiteCertificateAssetEvaluationService,
    private readonly tlsRenewal: MonitoringAlertSiteTlsRenewalEvaluationService,
  ) {}

  evaluateCertificateExpiry(rule: AlertRuleRecord): AlertEvaluationResult {
    return this.certificateExpiry.evaluate(rule);
  }

  evaluateCertificateAssetChange(rule: AlertRuleRecord): AlertEvaluationResult {
    return this.certificateAsset.evaluate(rule);
  }

  evaluateTlsRenewalFailure(rule: AlertRuleRecord): AlertEvaluationResult {
    return this.tlsRenewal.evaluate(rule);
  }
}
