/**
 * Pure Nginx/OpenResty config + certificate command generators and safety
 * checks for site sync/probe/renew plans. Extracted from `SiteService` so the
 * god service stays focused on orchestration. All functions are pure.
 */

import {
  isRecord,
  readBoolean,
  readString,
  readStringArray,
  type JsonRecord,
  type SiteRuntimeType,
} from './site-plan.types';

export function isSafeDomain(domain: string) {
  return /^(?:\*\.)?(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(domain);
}

export function isSafeProbeHostname(domain: string) {
  return /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(domain);
}

export function isSafeNginxPath(path: string) {
  return /^\/(?!.*\.\.)(?:[a-zA-Z0-9._@-]+\/?)+$/.test(path);
}

export function isSafeNginxSiteConfigPath(path: string) {
  return /^\/etc\/nginx\/conf\.d\/[a-z0-9.-]+\.conf$/.test(path);
}

export function isSafeUpstream(upstream: string) {
  return /^https?:\/\/[a-zA-Z0-9._:-]+(?:\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=%-]*)?$/.test(upstream)
    && !/[\s{};`$\\]/.test(upstream);
}

export function filenameForDomain(domain: string) {
  return domain.toLowerCase().replace(/[^a-z0-9.-]/g, '-');
}

export function generateNginxConfig(
  runtimeType: SiteRuntimeType,
  primaryDomain: string,
  serverNames: string[],
  runtimeConfig: JsonRecord,
  tls: JsonRecord,
  accessPolicy: JsonRecord,
) {
  const tlsEnabled = readBoolean(tls.enabled) === true;
  const serverNameLine = serverNames.length > 0 ? serverNames.join(' ') : primaryDomain;
  const lines: string[] = [
    'server {',
    tlsEnabled ? '    listen 443 ssl http2;' : '    listen 80;',
    tlsEnabled ? '    listen [::]:443 ssl http2;' : '    listen [::]:80;',
    `    server_name ${serverNameLine};`,
    '',
  ];

  if (tlsEnabled) {
    lines.push(
      `    ssl_certificate /etc/letsencrypt/live/${primaryDomain}/fullchain.pem;`,
      `    ssl_certificate_key /etc/letsencrypt/live/${primaryDomain}/privkey.pem;`,
      '    ssl_protocols TLSv1.2 TLSv1.3;',
      '',
    );
  }

  lines.push(...generateAccessPolicy(accessPolicy));

  if (runtimeType === 'static') {
    const rootPath = readString(runtimeConfig.rootPath) || `/var/www/${primaryDomain}`;
    lines.push(
      '    location / {',
      `        root ${rootPath};`,
      '        try_files $uri $uri/ /index.html;',
      '    }',
    );
  } else {
    const upstream = resolveUpstream(runtimeType, runtimeConfig) || 'http://127.0.0.1:3000';
    lines.push(
      '    location / {',
      `        proxy_pass ${upstream};`,
      '        proxy_http_version 1.1;',
      '        proxy_set_header Host $host;',
      '        proxy_set_header X-Real-IP $remote_addr;',
      '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
      '        proxy_set_header X-Forwarded-Proto $scheme;',
    );

    if (readBoolean(runtimeConfig.websocket) === true) {
      lines.push(
        '        proxy_set_header Upgrade $http_upgrade;',
        '        proxy_set_header Connection "upgrade";',
      );
    }

    lines.push('    }');
  }

  lines.push('}');

  if (tlsEnabled) {
    lines.push(
      '',
      'server {',
      '    listen 80;',
      '    listen [::]:80;',
      `    server_name ${serverNameLine};`,
      '    return 301 https://$server_name$request_uri;',
      '}',
    );
  }

  return lines.join('\n');
}

export function generateAccessPolicy(accessPolicy: JsonRecord) {
  const lines: string[] = [];
  const allowedCidrs = readStringArray(accessPolicy.allowedCidrs);

  if (allowedCidrs.length > 0) {
    for (const cidr of allowedCidrs) {
      lines.push(`    allow ${cidr};`);
    }
    lines.push('    deny all;', '');
  }

  if (readBoolean(accessPolicy.basicAuth) === true) {
    lines.push(
      '    auth_basic "Devpilot managed site";',
      '    auth_basic_user_file /etc/nginx/.htpasswd;',
      '',
    );
  }

  return lines;
}

export function resolveUpstream(runtimeType: SiteRuntimeType, runtimeConfig: JsonRecord) {
  const upstreamUrl = readString(runtimeConfig.upstreamUrl);
  if (upstreamUrl) return upstreamUrl;

  const host = readString(runtimeConfig.host);
  const port = readString(runtimeConfig.port) || String(runtimeConfig.port || '');
  if (host && port) {
    return `http://${host}:${port}`;
  }

  if (runtimeType === 'docker') {
    const containerName = readString(runtimeConfig.containerName);
    const containerPort = readString(runtimeConfig.containerPort) || String(runtimeConfig.containerPort || '');
    if (containerName && containerPort) {
      return `http://${containerName}:${containerPort}`;
    }
  }

  return undefined;
}

export function buildCertificateCommand(serverNames: string[], tls: JsonRecord) {
  if (readBoolean(tls.enabled) !== true || readString(tls.type) !== 'letsencrypt') {
    return '';
  }
  const email = readString(tls.email);
  if (!email) {
    return '';
  }
  const domains = serverNames.map((domain) => `-d ${domain}`).join(' ');
  return `certbot --nginx ${domains} --email ${email} --agree-tos --non-interactive`;
}

export function buildCertificateRenewCommand(certName: string, dryRun: boolean) {
  const dryRunFlag = dryRun ? ' --dry-run' : '';
  return `certbot renew --cert-name ${certName}${dryRunFlag} --non-interactive`;
}

export function resolveCertificateName(site: { primaryDomain: string }, tls: JsonRecord) {
  return readString(tls.certName) || site.primaryDomain;
}

export function isPreviewSitePlaceholder(runtimeConfig: JsonRecord) {
  const preview = isRecord(runtimeConfig.preview) ? runtimeConfig.preview : {};
  return readString(preview.kind) === 'draft_site_placeholder';
}
