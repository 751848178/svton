import { ProxyConfigService } from './proxy-config.service';

/**
 * 锁定 generateNginxConfig（mustache 模板渲染版）的输出格式。
 *
 * 这是生成给生产 nginx 的配置，必须保证：
 *  - HTTP/HTTPS/重定向块结构完整
 *  - SSL 证书路径按 letsencrypt/custom 正确分支
 *  - 多上游时生成 upstream 块
 *  - websocket/customConfig 条件包含
 *  - proxy_pass 的 `/` 不被 HTML 转义（用 {{{proxyPass}}}）
 */
describe('ProxyConfigService.generateNginxConfig (mustache)', () => {
  const service = new ProxyConfigService({} as never);

  it('renders a plain HTTP single-upstream config', () => {
    const out = service.generateNginxConfig({
      domain: 'app.example.com',
      upstreams: [{ host: '10.0.0.1', port: 8080 }],
      ssl: { enabled: false },
      websocket: false,
    });
    expect(out).toContain('listen 80;');
    expect(out).toContain('server_name app.example.com;');
    expect(out).toContain('proxy_pass http://10.0.0.1:8080;');
    expect(out).not.toContain('ssl_certificate');
    expect(out).not.toContain('listen 443');
  });

  it('renders multi-upstream HTTPS letsencrypt config with websocket and custom config', () => {
    const out = service.generateNginxConfig({
      domain: 'app.example.com',
      upstreams: [
        { host: '10.0.0.1', port: 8080, weight: 1 },
        { host: '10.0.0.2', port: 8080, weight: 3 },
      ],
      ssl: { enabled: true, type: 'letsencrypt' },
      websocket: true,
      customConfig: 'client_max_body_size 10m;\nproxy_read_timeout 60s;',
    });
    // upstream 块
    expect(out).toContain('upstream app_example_com {');
    expect(out).toContain('server 10.0.0.1:8080;');
    expect(out).toContain('server 10.0.0.2:8080 weight=3;');
    // HTTPS
    expect(out).toContain('listen 443 ssl http2;');
    expect(out).toContain('ssl_certificate /etc/letsencrypt/live/app.example.com/fullchain.pem;');
    // proxy_pass 指向 upstream（/ 不被转义）
    expect(out).toContain('proxy_pass http://app_example_com;');
    expect(out).not.toContain('&#x2F;');
    // websocket
    expect(out).toContain('proxy_set_header Upgrade $http_upgrade;');
    expect(out).toContain('proxy_set_header Connection "upgrade";');
    // customConfig
    expect(out).toContain('# Custom configuration');
    expect(out).toContain('client_max_body_size 10m;');
    // 重定向块
    expect(out).toContain('return 301 https://$server_name$request_uri;');
  });

  it('renders a self-signed SSL config (non-letsencrypt)', () => {
    const out = service.generateNginxConfig({
      domain: 'app.example.com',
      upstreams: [{ host: '10.0.0.1' }],
      ssl: { enabled: true, type: 'custom' },
      websocket: false,
    });
    expect(out).toContain('ssl_certificate /etc/nginx/ssl/app.example.com.crt;');
    expect(out).toContain('ssl_certificate_key /etc/nginx/ssl/app.example.com.key;');
    expect(out).not.toContain('letsencrypt');
  });

  it('does not produce 3+ consecutive newlines (whitespace normalized)', () => {
    const out = service.generateNginxConfig({
      domain: 'app.example.com',
      upstreams: [{ host: '10.0.0.1' }, { host: '10.0.0.2' }],
      ssl: { enabled: true, type: 'letsencrypt' },
      websocket: true,
      customConfig: 'gzip on;',
    });
    expect(out).not.toMatch(/\n{3,}/);
  });
});
