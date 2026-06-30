/** 站点域工具 - 接管表单构建与 TLS 配置（纯函数）。 */

import type { Site, SiteTakeoverForm } from './types';
import { readRecord, readString, readBoolean, readStringArray, readRecordArray } from './utils';

export function createSiteTakeoverForm(site: Site): SiteTakeoverForm {
  const tls = readRecord(site.tls);
  const runtimeConfig = readRecord(site.runtimeConfig);

  return {
    serverId: site.server?.id || '',
    upstreamUrl: readString(runtimeConfig.upstreamUrl) || '',
    websocket: readBoolean(runtimeConfig.websocket),
    tlsEnabled: readBoolean(tls.enabled),
    tlsType: readString(tls.type) || 'letsencrypt',
    tlsEmail: readString(tls.email) || '',
    tlsCertName: readString(tls.certName) || site.primaryDomain,
    tlsAssetId: readString(tls.currentCertificateAssetId) || '',
  };
}

export function buildSiteTakeoverTls(site: Site, form: SiteTakeoverForm) {
  const currentTls = readRecord(site.tls);
  const nextTls: Record<string, unknown> = { ...currentTls };
  const assets = readRecordArray(currentTls.assets);
  const selectedAsset = assets.find((asset) => readString(asset.id) === form.tlsAssetId);

  nextTls.enabled = form.tlsEnabled;
  nextTls.type = form.tlsEnabled ? form.tlsType || 'letsencrypt' : 'none';

  if (form.tlsEnabled && form.tlsType === 'letsencrypt' && form.tlsEmail.trim()) {
    nextTls.email = form.tlsEmail.trim();
  } else {
    delete nextTls.email;
  }

  if (form.tlsEnabled && form.tlsCertName.trim()) {
    nextTls.certName = form.tlsCertName.trim();
  } else {
    delete nextTls.certName;
  }

  if (form.tlsEnabled && form.tlsAssetId) {
    nextTls.currentCertificateAssetId = form.tlsAssetId;
    if (selectedAsset) {
      nextTls.certificate = {
        ...readRecord(nextTls.certificate),
        ...selectedAsset,
      };
    }
  } else {
    delete nextTls.currentCertificateAssetId;
    if (!form.tlsEnabled) {
      delete nextTls.certificate;
    }
  }

  return nextTls;
}

export function isPreviewSitePlaceholder(site: Site) {
  const runtimeConfig = readRecord(site.runtimeConfig);
  const preview = readRecord(runtimeConfig.preview);

  return (
    readString(preview.kind) === 'draft_site_placeholder' &&
    readString(preview.status) !== 'archived' &&
    readBoolean(runtimeConfig.syncBlocked)
  );
}
