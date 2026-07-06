/**
 * Nginx server block 模板（mustache 语法）。
 *
 * 用 mustache 的行内 section（`{{#x}}...{{/x}}` 紧贴内容）+ render 后规范空行，
 * 取代原 `+=` 命令式拼接与声明式分段模板字面量。
 *
 * mustache 的 standalone section（`{{#x}}` 独占一行）会消费该行换行，导致 nginx 配置
 * 的空白不可控；行内写法 + `\n{3,}` → `\n\n` 后处理解决了这个问题。
 */
export const NGINX_CONFIG_TEMPLATE = `{{#upstreamBlock}}upstream {{upstreamName}} {
{{#upstreamLines}}    server {{host}}:{{port}}{{#weight}} weight={{weight}}{{/weight}};
{{/upstreamLines}}}

{{/upstreamBlock}}server {
{{#sslEnabled}}    listen 443 ssl http2;
    listen [::]:443 ssl http2;
{{/sslEnabled}}{{^sslEnabled}}    listen 80;
    listen [::]:80;
{{/sslEnabled}}    server_name {{domain}};
{{#sslEnabled}}
{{#letsencrypt}}    ssl_certificate /etc/letsencrypt/live/{{domain}}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{{domain}}/privkey.pem;
{{/letsencrypt}}{{^letsencrypt}}    ssl_certificate /etc/nginx/ssl/{{domain}}.crt;
    ssl_certificate_key /etc/nginx/ssl/{{domain}}.key;
{{/letsencrypt}}    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

{{/sslEnabled}}    location / {
        proxy_pass {{{proxyPass}}};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
{{#websocket}}        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
{{/websocket}}    }
{{#hasCustomConfig}}
    # Custom configuration
{{#customConfigLines}}    {{.}}
{{/customConfigLines}}{{/hasCustomConfig}}}
{{#sslEnabled}}
server {
    listen 80;
    listen [::]:80;
    server_name {{domain}};
    return 301 https://$server_name$request_uri;
}
{{/sslEnabled}}`;
