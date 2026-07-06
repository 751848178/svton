import { Injectable } from '@nestjs/common';
import type { AlertRuleRecord } from './monitoring-alert-rule.types';
import type { AlertEvaluationResult } from './monitoring-alert-evaluation.types';
import { MonitoringAlertEvaluationResultService } from './monitoring-alert-evaluation-result.service';
import { MonitoringAlertSiteCertificateReaderService } from './monitoring-alert-site-certificate-reader.service';

@Injectable()
export class MonitoringAlertSiteTlsRenewalEvaluationService {
  constructor(
    private readonly result: MonitoringAlertEvaluationResultService,
    private readonly reader: MonitoringAlertSiteCertificateReaderService,
  ) {}

  evaluate(rule: AlertRuleRecord): AlertEvaluationResult {
    const site = rule.site;
    if (!site) {
      return this.result.insufficient(rule, '规则未绑定站点目标', {});
    }

    const tls = this.reader.asRecord(site.tls);
    const renewal = this.reader.asRecord(tls.renewal);
    const followUpProbe = this.reader.asRecord(renewal.followUpProbe);
    const renewalStatus = this.reader.readString(renewal.status) || this.reader.readString(tls.lastRenewalStatus);
    const followUpProbeStatus =
      this.reader.readString(followUpProbe.status) || this.reader.readString(tls.lastRenewalFollowUpProbeStatus);
    const value = {
      siteId: site.id,
      siteName: site.name,
      primaryDomain: site.primaryDomain,
      siteStatus: site.status,
      tlsType: this.reader.readString(tls.type) || 'unknown',
      renewalStatus: renewalStatus || null,
      renewalRunId: this.reader.readString(renewal.runId) || this.reader.readString(tls.lastRenewalRunId) || null,
      renewalCheckedAt:
        this.reader.readString(renewal.checkedAt) || this.reader.readString(tls.lastRenewalCheckedAt) || null,
      renewalSummary: this.reader.readString(renewal.summary) || this.reader.readString(tls.lastRenewalSummary) || null,
      renewalFailureReason:
        this.reader.readString(renewal.failureReason) || this.reader.readString(tls.lastRenewalFailureReason) || null,
      followUpProbeStatus: followUpProbeStatus || null,
      followUpProbeRunId:
        this.reader.readString(followUpProbe.siteSyncRunId) ||
        this.reader.readString(tls.lastRenewalFollowUpProbeRunId) ||
        null,
      followUpProbeJobId:
        this.reader.readString(followUpProbe.serverExecutionJobId) ||
        this.reader.readString(tls.lastRenewalFollowUpProbeJobId) ||
        null,
      followUpProbeError: this.reader.readString(followUpProbe.error) || null,
    };

    if (!renewalStatus && !followUpProbeStatus) {
      return this.result.insufficient(rule, `站点 ${site.name} 没有 TLS 续期记录`, value);
    }
    if (renewalStatus === 'failed') {
      return this.result.firing(
        rule,
        `站点 ${site.name} TLS 续期失败${value.renewalSummary ? `: ${value.renewalSummary}` : ''}`,
        value,
      );
    }
    if (followUpProbeStatus === 'failed') {
      return this.result.firing(
        rule,
        `站点 ${site.name} TLS 续期后证书探测失败${value.followUpProbeError ? `: ${value.followUpProbeError}` : ''}`,
        value,
      );
    }
    return this.result.ok(rule, `站点 ${site.name} TLS 续期链路未发现失败`, value);
  }
}
