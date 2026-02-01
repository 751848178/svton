import { Injectable, BadRequestException } from '@nestjs/common';
import { DomainConfigDto, SSLMode } from './dto/domain.dto';

@Injectable()
export class DomainService {
  // 验证域名格式
  validateDomain(domain: string): boolean {
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  }

  // 生成 Nginx 配置
  generateNginxConfig(config: DomainConfigDto): string {
    if (!this.validateDomain(config.domain)) {
      throw new BadRequestException('Invalid domain format');
    }

    const lines: string[] = [];
    const upstream = config.upstream;
    const upstreamPort = config.upstreamPort || 3000;

    // HTTP 配置（用于 SSL 重定向或直接服务）
    if (config.sslMode && config.sslMode !== SSLMode.NONE) {
      // HTTP -> HTTPS 重定向
      lines.push(`server {`);
      lines.push(`    listen 80;`);
      lines.push(`    listen [::]:80;`);
      lines.push(`    server_name ${config.domain};`);
      lines.push(``);
      lines.push(`    location / {`);
      lines.push(`        return 301 https://$host$request_uri;`);
      lines.push(`    }`);
      lines.push(`}`);
      lines.push(``);

      // HTTPS 配置
      lines.push(`server {`);
      lines.push(`    listen 443 ssl http2;`);
      lines.push(`    listen [::]:443 ssl http2;`);
      lines.push(`    server_name ${config.domain};`);
      lines.push(``);

      // SSL 证书配置
      if (config.sslMode === SSLMode.LETSENCRYPT) {
        lines.push(`    ssl_certificate /etc/letsencrypt/live/${config.domain}/fullchain.pem;`);
        lines.push(`    ssl_certificate_key /etc/letsencrypt/live/${config.domain}/privkey.pem;`);
      } else if (config.sslMode === SSLMode.CUSTOM) {
        lines.push(`    ssl_certificate /etc/nginx/ssl/${config.domain}.crt;`);
        lines.push(`    ssl_certificate_key /etc/nginx/ssl/${config.domain}.key;`);
      }

      // SSL 安全配置
      lines.push(``);
      lines.push(`    # SSL Security`);
      lines.push(`    ssl_protocols TLSv1.2 TLSv1.3;`);
      lines.push(`    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;`);
      lines.push(`    ssl_prefer_server_ciphers off;`);
      lines.push(`    ssl_session_cache shared:SSL:10m;`);
      lines.push(`    ssl_session_timeout 1d;`);
    } else {
      // 纯 HTTP 配置
      lines.push(`server {`);
      lines.push(`    listen 80;`);
      lines.push(`    listen [::]:80;`);
      lines.push(`    server_name ${config.domain};`);
    }

    lines.push(``);

    // 客户端请求体大小
    const maxBodySize = config.clientMaxBodySize || 10;
    lines.push(`    client_max_body_size ${maxBodySize}m;`);
    lines.push(``);

    // Gzip 压缩
    if (config.enableGzip !== false) {
      lines.push(`    # Gzip Compression`);
      lines.push(`    gzip on;`);
      lines.push(`    gzip_vary on;`);
      lines.push(`    gzip_min_length 1024;`);
      lines.push(`    gzip_proxied any;`);
      lines.push(`    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;`);
      lines.push(``);
    }

    // 反向代理配置
    lines.push(`    location / {`);
    lines.push(`        proxy_pass ${upstream}:${upstreamPort};`);
    lines.push(`        proxy_http_version 1.1;`);
    lines.push(`        proxy_set_header Host $host;`);
    lines.push(`        proxy_set_header X-Real-IP $remote_addr;`);
    lines.push(`        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`);
    lines.push(`        proxy_set_header X-Forwarded-Proto $scheme;`);

    // WebSocket 支持
    if (config.enableWebSocket) {
      lines.push(``);
      lines.push(`        # WebSocket Support`);
      lines.push(`        proxy_set_header Upgrade $http_upgrade;`);
      lines.push(`        proxy_set_header Connection "upgrade";`);
      lines.push(`        proxy_read_timeout 86400;`);
    }

    lines.push(`    }`);
    lines.push(``);

    // 静态文件缓存
    lines.push(`    # Static Files Cache`);
    lines.push(`    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {`);
    lines.push(`        proxy_pass ${upstream}:${upstreamPort};`);
    lines.push(`        expires 30d;`);
    lines.push(`        add_header Cache-Control "public, immutable";`);
    lines.push(`    }`);

    lines.push(`}`);

    return lines.join('\n');
  }

  // 生成 Let's Encrypt 证书申请脚本
  generateCertbotScript(domain: string, email: string): string {
    return `#!/bin/bash
# Let's Encrypt Certificate Script for ${domain}

# Install certbot if not exists
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

# Request certificate
certbot certonly --nginx \\
    -d ${domain} \\
    --email ${email} \\
    --agree-tos \\
    --non-interactive

# Setup auto-renewal
echo "0 0 * * * root certbot renew --quiet" >> /etc/crontab

echo "Certificate installed successfully!"
echo "Certificate path: /etc/letsencrypt/live/${domain}/"
`;
  }

  // 生成多域名配置
  generateMultiDomainConfig(configs: DomainConfigDto[]): string {
    return configs.map(config => this.generateNginxConfig(config)).join('\n\n');
  }
}
