import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateServerCommandPolicyTemplateDto,
  ListServerCommandPolicyTemplatesQueryDto,
  UpdateServerCommandPolicyTemplateDto,
} from './dto/server-command-policy-template.dto';
import {
  ServerCommandPolicyDecision,
  ServerCommandPolicyResult,
  ServerCommandStep,
  ServerExecutionInput,
} from './server-executor.types';

type CommandRule = {
  key: string;
  description: string;
  adapters: string[];
  operations?: string[];
  pattern: RegExp;
};

type PolicyTemplateRecord = {
  id: string;
  name: string;
  adapterKeys: Prisma.JsonValue | null;
  operationKeys: Prisma.JsonValue | null;
  allowedPatterns: Prisma.JsonValue | null;
  blockedPatterns: Prisma.JsonValue | null;
};

@Injectable()
export class ServerCommandPolicyService {
  private readonly policyKey = 'server-command-policy:built-in-baseline:v1';

  constructor(private readonly prisma: PrismaService) {}

  private readonly dangerousPatterns: Array<{ key: string; pattern: RegExp; reason: string }> = [
    { key: 'rm-root', pattern: /\brm\s+-rf\s+\/(?:\s|$)/, reason: '禁止递归删除根目录' },
    { key: 'mkfs', pattern: /\bmkfs(?:\.[a-z0-9]+)?\b/i, reason: '禁止格式化文件系统' },
    { key: 'dd-raw-disk', pattern: /\bdd\s+.*\bof=\/dev\//i, reason: '禁止直接写块设备' },
    { key: 'fork-bomb', pattern: /:\s*\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}/, reason: '禁止 fork bomb' },
    { key: 'shutdown', pattern: /\b(shutdown|poweroff|halt|reboot)\b/i, reason: '禁止关机或重启服务器' },
    { key: 'pipe-to-shell', pattern: /\b(curl|wget)\b.*\|\s*(sh|bash)\b/i, reason: '禁止远程脚本直接管道到 shell' },
    { key: 'passwd-shadow', pattern: />\s*\/etc\/(passwd|shadow)\b/i, reason: '禁止覆盖系统账号文件' },
    { key: 'chmod-root', pattern: /\bchmod\s+777\s+\/(?:\s|$)/i, reason: '禁止修改根目录为 777' },
  ];

  private readonly rules: CommandRule[] = [
    {
      key: 'docker-inspect',
      description: 'Docker inspect',
      adapters: ['server-resource-script-plan', 'resource-connection-plan'],
      pattern: /^docker inspect [a-zA-Z0-9_.:/@-]+$/,
    },
    {
      key: 'docker-logs',
      description: 'Docker logs tail',
      adapters: ['server-resource-script-plan', 'application-service-runtime-plan', 'log-collection-plan'],
      pattern: /^docker logs --tail=\d{1,5} [a-zA-Z0-9_.:/@-]+$/,
    },
    {
      key: 'docker-stats-json-snapshot',
      description: 'Docker stats single JSON snapshot',
      adapters: ['server-resource-script-plan'],
      pattern: /^docker stats --no-stream --format '\{\{json \.\}\}' [a-zA-Z0-9_.:/@-]+$/,
    },
    {
      key: 'docker-restart',
      description: 'Docker restart',
      adapters: ['server-resource-script-plan', 'application-service-runtime-plan'],
      pattern: /^docker restart [a-zA-Z0-9_.:/@-]+$/,
    },
    {
      key: 'docker-ps',
      description: 'Docker ps status',
      adapters: ['application-service-runtime-plan'],
      pattern: /^docker ps --filter name=(?:'[^']+'|[a-zA-Z0-9_.:/@-]+) --format "table \{\{\.Names\}\}\\t\{\{\.Image\}\}\\t\{\{\.Status\}\}\\t\{\{\.Ports\}\}"$/,
    },
    {
      key: 'docker-ps-json-inventory',
      description: 'Docker inventory as JSON lines',
      adapters: ['docker-inventory-plan'],
      pattern: /^docker ps -a --no-trunc --format '\{\{json \.\}\}'$/,
    },
    {
      key: 'docker-exec-mysqladmin',
      description: 'MySQL ping inside Docker',
      adapters: ['server-resource-script-plan', 'resource-connection-plan'],
      pattern: /^docker exec [a-zA-Z0-9_.:/@-]+ mysqladmin ping -h 127\.0\.0\.1 -P \d{1,5}$/,
    },
    {
      key: 'docker-exec-mysqldump',
      description: 'MySQL dump inside Docker',
      adapters: ['server-resource-script-plan', 'backup-script-plan'],
      pattern: /^docker exec [a-zA-Z0-9_.:/@-]+ sh -lc 'mysqldump --single-transaction --all-databases > \/tmp\/devpilot-backup\.sql'$/,
    },
    {
      key: 'docker-cp-mysql-backup',
      description: 'Copy MySQL backup out of Docker',
      adapters: ['server-resource-script-plan', 'backup-script-plan'],
      pattern: /^docker cp [a-zA-Z0-9_.:/@-]+:\/tmp\/devpilot-backup\.sql \/var\/backups\/devpilot\/mysql\/devpilot-backup\.sql$/,
    },
    {
      key: 'docker-exec-redis-bgsave',
      description: 'Redis BGSAVE inside Docker',
      adapters: ['backup-script-plan'],
      pattern: /^docker exec [a-zA-Z0-9_.:/@-]+ redis-cli BGSAVE$/,
    },
    {
      key: 'docker-cp-redis-backup',
      description: 'Copy Redis backup out of Docker',
      adapters: ['backup-script-plan'],
      pattern: /^docker cp [a-zA-Z0-9_.:/@-]+:\/data\/dump\.rdb \/var\/backups\/devpilot\/redis\/dump\.rdb$/,
    },
    {
      key: 'docker-exec-redis-info',
      description: 'Redis info inside Docker',
      adapters: ['server-resource-script-plan'],
      pattern: /^docker exec [a-zA-Z0-9_.:/@-]+ redis-cli INFO server$/,
    },
    {
      key: 'docker-exec-redis-ping',
      description: 'Redis ping inside Docker',
      adapters: ['resource-connection-plan'],
      pattern: /^docker exec [a-zA-Z0-9_.:/@-]+ redis-cli PING$/,
    },
    {
      key: 'backup-directory',
      description: 'Create Devpilot backup directory',
      adapters: ['server-resource-script-plan', 'backup-script-plan'],
      pattern: /^mkdir -p \/var\/backups\/devpilot\/(?:mysql|redis)$/,
    },
    {
      key: 'docker-compose-status',
      description: 'Docker Compose status',
      adapters: ['application-service-runtime-plan'],
      pattern: /^docker compose ps (?:'[^']+'|[a-zA-Z0-9_.:/@-]+)$/,
    },
    {
      key: 'docker-compose-logs',
      description: 'Docker Compose logs tail',
      adapters: ['application-service-runtime-plan', 'log-collection-plan'],
      pattern: /^docker compose logs --tail=\d{1,5} (?:'[^']+'|[a-zA-Z0-9_.:/@-]+)$/,
    },
    {
      key: 'docker-compose-restart',
      description: 'Docker Compose restart',
      adapters: ['application-service-runtime-plan'],
      pattern: /^docker compose restart (?:'[^']+'|[a-zA-Z0-9_.:/@-]+)$/,
    },
    {
      key: 'curl-health-check',
      description: 'HTTP health check',
      adapters: ['application-service-runtime-plan', 'deployment-script-plan'],
      operations: [
        'application-service.status',
        'application-service.restart',
        'application-service.rollback',
        'deployment.run',
        'deployment.rollback',
        'deployment.smoke_check',
      ],
      pattern: /^curl -fsS (?:'https?:\/\/[^']+'|https?:\/\/\S+)$/,
    },
    {
      key: 'site-public-smoke-check',
      description: 'Site public domain smoke check',
      adapters: ['nginx-site-plan'],
      operations: ['site.smoke_check'],
      pattern: /^curl -fsS https?:\/\/[a-zA-Z0-9.-]+(?:\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=%-]*)?$/,
    },
    {
      key: 'site-local-host-smoke-check',
      description: 'Site local Nginx host routing smoke check',
      adapters: ['nginx-site-plan'],
      operations: ['site.smoke_check'],
      pattern: /^curl -fsS -H 'Host: [a-zA-Z0-9.-]+' http:\/\/127\.0\.0\.1(?::\d{1,5})?\/?$/,
    },
    {
      key: 'nginx-config-heredoc',
      description: 'Write generated Nginx site config',
      adapters: ['nginx-site-plan'],
      pattern: /^cat > \/etc\/nginx\/conf\.d\/[a-z0-9.-]+\.conf <<'EOF'\n[\s\S]+\nEOF$/,
    },
    {
      key: 'certbot-nginx',
      description: 'Issue Let’s Encrypt certificate with certbot nginx plugin',
      adapters: ['nginx-site-plan'],
      pattern: /^certbot --nginx (?:-d [a-zA-Z0-9.-]+ ?)+--email [^\s@]+@[^\s@]+\.[^\s@]+ --agree-tos --non-interactive$/,
    },
    {
      key: 'openssl-site-tls-probe',
      description: 'Probe site TLS certificate metadata with OpenSSL',
      adapters: ['nginx-site-plan'],
      operations: ['site.tls_probe'],
      pattern: /^echo \| openssl s_client -servername [a-zA-Z0-9.-]+ -connect [a-zA-Z0-9.-]+:443 2>\/dev\/null \| openssl x509 -noout -subject -issuer -serial -dates -fingerprint -sha256$/,
    },
    {
      key: 'certbot-renew-dry-run',
      description: 'Dry-run renew Let’s Encrypt certificate by cert name',
      adapters: ['nginx-site-plan'],
      operations: ['site.tls_renew'],
      pattern: /^certbot renew --cert-name [a-zA-Z0-9.-]+ --dry-run --non-interactive$/,
    },
    {
      key: 'certbot-renew',
      description: 'Renew Let’s Encrypt certificate by cert name',
      adapters: ['nginx-site-plan'],
      operations: ['site.tls_renew'],
      pattern: /^certbot renew --cert-name [a-zA-Z0-9.-]+ --non-interactive$/,
    },
    {
      key: 'nginx-config-test-status',
      description: 'Read Nginx config test status without failing the status probe',
      adapters: ['nginx-site-plan'],
      operations: ['site.openresty_status'],
      pattern: /^nginx -t 2>&1 \|\| true$/,
    },
    {
      key: 'nginx-version-status',
      description: 'Read Nginx build information',
      adapters: ['nginx-site-plan'],
      operations: ['site.openresty_status'],
      pattern: /^nginx -V 2>&1 \|\| true$/,
    },
    {
      key: 'openresty-version-status',
      description: 'Read OpenResty build information',
      adapters: ['nginx-site-plan'],
      operations: ['site.openresty_status'],
      pattern: /^openresty -V 2>&1 \|\| true$/,
    },
    {
      key: 'nginx-service-active-status',
      description: 'Read Nginx systemd active status',
      adapters: ['nginx-site-plan'],
      operations: ['site.openresty_status'],
      pattern: /^systemctl is-active nginx \|\| true$/,
    },
    {
      key: 'openresty-service-active-status',
      description: 'Read OpenResty systemd active status',
      adapters: ['nginx-site-plan'],
      operations: ['site.openresty_status'],
      pattern: /^systemctl is-active openresty \|\| true$/,
    },
    {
      key: 'nginx-openresty-process-status',
      description: 'Read Nginx/OpenResty process status summary',
      adapters: ['nginx-site-plan'],
      operations: ['site.openresty_status'],
      pattern: /^ps -eo pid,comm,args \| grep -E 'nginx\|openresty' \| grep -v grep \| head -20 \|\| true$/,
    },
    {
      key: 'nginx-module-config-args',
      description: 'Read Nginx compiled module configure arguments',
      adapters: ['nginx-site-plan'],
      operations: ['site.openresty_modules'],
      pattern: /^nginx -V 2>&1 \|\| true$/,
    },
    {
      key: 'openresty-module-config-args',
      description: 'Read OpenResty compiled module configure arguments',
      adapters: ['nginx-site-plan'],
      operations: ['site.openresty_modules'],
      pattern: /^openresty -V 2>&1 \|\| true$/,
    },
    {
      key: 'nginx-dynamic-module-files',
      description: 'Read Nginx/OpenResty dynamic module files from fixed module directories',
      adapters: ['nginx-site-plan'],
      operations: ['site.openresty_modules'],
      pattern: /^find \/etc\/nginx\/modules-enabled \/usr\/lib\/nginx\/modules \/usr\/local\/openresty\/nginx\/modules -maxdepth 1 -type f -name '\*\.so' -print 2>\/dev\/null \| sort \|\| true$/,
    },
    {
      key: 'openresty-baseline-tls',
      description: 'Check TLS/SSL module baseline',
      adapters: ['nginx-site-plan'],
      operations: ['site.openresty_module_baseline'],
      pattern: /^\(nginx -V 2>&1 \|\| true; openresty -V 2>&1 \|\| true\) \| grep -Eq -- '--with-http_ssl_module\|--with-openssl' && echo 'present: tls' \|\| echo 'missing: tls'$/,
    },
    {
      key: 'openresty-baseline-http2',
      description: 'Check HTTP/2 or HTTP/3 module baseline',
      adapters: ['nginx-site-plan'],
      operations: ['site.openresty_module_baseline'],
      pattern: /^\(nginx -V 2>&1 \|\| true; openresty -V 2>&1 \|\| true\) \| grep -Eq -- '--with-http_v2_module\|--with-http_v3_module' && echo 'present: http2_or_http3' \|\| echo 'missing: http2_or_http3'$/,
    },
    {
      key: 'openresty-baseline-realip',
      description: 'Check real IP module baseline',
      adapters: ['nginx-site-plan'],
      operations: ['site.openresty_module_baseline'],
      pattern: /^\(nginx -V 2>&1 \|\| true; openresty -V 2>&1 \|\| true\) \| grep -Eq -- '--with-http_realip_module' && echo 'present: realip' \|\| echo 'missing: realip'$/,
    },
    {
      key: 'openresty-baseline-stub-status',
      description: 'Check stub_status module baseline',
      adapters: ['nginx-site-plan'],
      operations: ['site.openresty_module_baseline'],
      pattern: /^\(nginx -V 2>&1 \|\| true; openresty -V 2>&1 \|\| true\) \| grep -Eq -- '--with-http_stub_status_module' && echo 'present: stub_status' \|\| echo 'missing: stub_status'$/,
    },
    {
      key: 'openresty-baseline-stream',
      description: 'Check stream module baseline',
      adapters: ['nginx-site-plan'],
      operations: ['site.openresty_module_baseline'],
      pattern: /^\(nginx -V 2>&1 \|\| true; openresty -V 2>&1 \|\| true\) \| grep -Eq -- '--with-stream' && echo 'present: stream' \|\| echo 'missing: stream'$/,
    },
    {
      key: 'openresty-baseline-lua',
      description: 'Check Lua/OpenResty module baseline',
      adapters: ['nginx-site-plan'],
      operations: ['site.openresty_module_baseline'],
      pattern: /^\(nginx -V 2>&1 \|\| true; openresty -V 2>&1 \|\| true; find \/etc\/nginx\/modules-enabled \/usr\/lib\/nginx\/modules \/usr\/local\/openresty\/nginx\/modules -maxdepth 1 -type f -name '\*\.so' -print 2>\/dev\/null \|\| true\) \| grep -Eiq 'http_lua\|lua-nginx\|ngx_http_lua\|lua\.\*\\\.so' && echo 'present: lua' \|\| echo 'missing: lua'$/,
    },
    {
      key: 'nginx-test',
      description: 'Validate Nginx config',
      adapters: ['nginx-site-plan'],
      pattern: /^nginx -t$/,
    },
    {
      key: 'nginx-reload',
      description: 'Reload Nginx',
      adapters: ['nginx-site-plan'],
      pattern: /^systemctl reload nginx \|\| nginx -s reload$/,
    },
    {
      key: 'tail-nginx-log',
      description: 'Tail Nginx log file',
      adapters: ['log-collection-plan', 'nginx-site-plan'],
      pattern: /^tail -n \d{1,5} \/var\/log\/nginx\/(access|error)\.log$/,
    },
    {
      key: 'tail-nginx-log-optional',
      description: 'Tail Nginx log file without failing diagnostics when the file is absent',
      adapters: ['nginx-site-plan'],
      pattern: /^tail -n \d{1,5} \/var\/log\/nginx\/(access|error)\.log \|\| true$/,
    },
    {
      key: 'tail-var-log',
      description: 'Tail a log file under /var/log',
      adapters: ['log-collection-plan'],
      pattern: /^tail -n \d{1,5} \/var\/log\/(?!.*\.\.)[a-zA-Z0-9_./@-]+\.log$/,
    },
    {
      key: 'git-deployment-checkout',
      description: 'Deployment git checkout',
      adapters: ['deployment-script-plan'],
      pattern: /^git fetch --all --prune && git checkout [a-zA-Z0-9._/@-]+ && git pull$/,
    },
    {
      key: 'git-deployment-rollback-checkout',
      description: 'Deployment rollback checkout by commit sha',
      adapters: ['deployment-script-plan'],
      pattern: /^git fetch --all --prune && git checkout [a-fA-F0-9]{7,64}$/,
    },
    {
      key: 'node-build',
      description: 'Common Node.js build commands',
      adapters: ['deployment-script-plan'],
      pattern: /^(pnpm|npm|yarn|bun)(?: [a-zA-Z0-9_./:@=-]+)* (build|run build|install|ci)(?: [a-zA-Z0-9_./:@=-]+)*$/,
    },
    {
      key: 'docker-build',
      description: 'Docker build commands',
      adapters: ['deployment-script-plan'],
      pattern: /^docker (?:build|compose build)(?: [a-zA-Z0-9_./:@=+-]+)*$/,
    },
    {
      key: 'docker-compose-deploy',
      description: 'Docker Compose deployment commands',
      adapters: ['deployment-script-plan'],
      pattern: /^docker compose (?:pull|up -d(?: --build)?|restart)(?: [a-zA-Z0-9_./:@=+-]+)*$/,
    },
  ];

  async listTemplates(teamId: string, query: ListServerCommandPolicyTemplatesQueryDto) {
    const where: Prisma.ServerCommandPolicyTemplateWhereInput = { teamId };
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;
    if (query.enabled === 'true') where.enabled = true;
    if (query.enabled === 'false') where.enabled = false;

    const templates = await this.prisma.serverCommandPolicyTemplate.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        environment: { select: { id: true, key: true, name: true } },
      },
    });

    return templates.filter((template) => (
      this.matchesStringList(template.adapterKeys, query.adapterKey) &&
      this.matchesStringList(template.operationKeys, query.operationKey)
    ));
  }

  async createTemplate(
    teamId: string,
    userId: string,
    dto: CreateServerCommandPolicyTemplateDto,
  ) {
    await this.assertTemplateBindings(teamId, dto.projectId, dto.environmentId);
    this.assertPatterns(dto.allowedPatterns || []);
    this.assertPatterns(dto.blockedPatterns || []);

    return this.prisma.serverCommandPolicyTemplate.create({
      data: {
        teamId,
        createdById: userId,
        name: dto.name,
        description: dto.description,
        projectId: dto.projectId || undefined,
        environmentId: dto.environmentId || undefined,
        enabled: dto.enabled ?? true,
        priority: dto.priority ?? 0,
        adapterKeys: this.toStringListJson(dto.adapterKeys),
        operationKeys: this.toStringListJson(dto.operationKeys),
        allowedPatterns: this.toStringListJson(dto.allowedPatterns),
        blockedPatterns: this.toStringListJson(dto.blockedPatterns),
      },
    });
  }

  async getTemplateAccessScope(teamId: string, id: string) {
    const template = await this.prisma.serverCommandPolicyTemplate.findFirst({
      where: { id, teamId },
      select: { id: true, projectId: true, environmentId: true },
    });

    if (!template) {
      throw new NotFoundException('Server executor 命令策略模板不存在');
    }

    return {
      projectId: template.projectId,
      environmentId: template.environmentId,
    };
  }

  async updateTemplate(
    teamId: string,
    id: string,
    dto: UpdateServerCommandPolicyTemplateDto,
  ) {
    const existing = await this.prisma.serverCommandPolicyTemplate.findFirst({
      where: { id, teamId },
    });

    if (!existing) {
      throw new NotFoundException('Server executor 命令策略模板不存在');
    }

    const nextProjectId = dto.projectId !== undefined ? dto.projectId || undefined : existing.projectId || undefined;
    const nextEnvironmentId = dto.environmentId !== undefined ? dto.environmentId || undefined : existing.environmentId || undefined;
    await this.assertTemplateBindings(teamId, nextProjectId, nextEnvironmentId);
    if (dto.allowedPatterns) this.assertPatterns(dto.allowedPatterns);
    if (dto.blockedPatterns) this.assertPatterns(dto.blockedPatterns);

    const data: Prisma.ServerCommandPolicyTemplateUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.projectId !== undefined) data.project = dto.projectId ? { connect: { id: dto.projectId } } : { disconnect: true };
    if (dto.environmentId !== undefined) data.environment = dto.environmentId ? { connect: { id: dto.environmentId } } : { disconnect: true };
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.adapterKeys !== undefined) data.adapterKeys = this.toStringListJson(dto.adapterKeys);
    if (dto.operationKeys !== undefined) data.operationKeys = this.toStringListJson(dto.operationKeys);
    if (dto.allowedPatterns !== undefined) data.allowedPatterns = this.toStringListJson(dto.allowedPatterns);
    if (dto.blockedPatterns !== undefined) data.blockedPatterns = this.toStringListJson(dto.blockedPatterns);

    return this.prisma.serverCommandPolicyTemplate.update({
      where: { id },
      data,
    });
  }

  async deleteTemplate(teamId: string, id: string) {
    const existing = await this.prisma.serverCommandPolicyTemplate.findFirst({
      where: { id, teamId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Server executor 命令策略模板不存在');
    }

    await this.prisma.serverCommandPolicyTemplate.delete({ where: { id } });
    return { deleted: true };
  }

  async evaluate(input: ServerExecutionInput): Promise<ServerCommandPolicyResult> {
    const templates = await this.loadMatchingTemplates(input);
    const decisions = input.steps.map((step) => this.evaluateStep(input, step, templates));
    const blocked = decisions.filter((decision) => decision.status === 'blocked');
    const templateKeys = templates.map((template) => template.id);

    return {
      status: blocked.length > 0 ? 'blocked' : 'passed',
      policyKey: templateKeys.length
        ? `${this.policyKey}+templates:${templateKeys.join(',')}`
        : this.policyKey,
      mode: templateKeys.length ? 'built_in_with_templates' : 'built_in_baseline',
      templateKeys,
      decisions,
      warnings: blocked.map((decision) => `${decision.label}: ${decision.reason}`),
      blockedReasons: blocked.map((decision) => decision.reason),
    };
  }

  private evaluateStep(
    input: ServerExecutionInput,
    step: ServerCommandStep,
    templates: PolicyTemplateRecord[],
  ): ServerCommandPolicyDecision {
    if (!step.command) {
      return {
        stepKey: step.key,
        label: step.label,
        command: step.command,
        status: 'allowed',
        ruleKey: 'empty-command',
        reason: step.required ? '必填命令为空，将由执行器可执行性检查处理' : '非必填空命令',
      };
    }

    const dangerous = this.dangerousPatterns.find((item) => item.pattern.test(step.command));
    if (dangerous) {
      return {
        stepKey: step.key,
        label: step.label,
        command: step.command,
        status: 'blocked',
        ruleKey: dangerous.key,
        reason: dangerous.reason,
      };
    }

    const blockedByTemplate = this.findTemplatePatternMatch(
      templates,
      'blockedPatterns',
      step.command,
    );
    if (blockedByTemplate) {
      return {
        stepKey: step.key,
        label: step.label,
        command: step.command,
        status: 'blocked',
        ruleKey: `template-block:${blockedByTemplate.template.id}`,
        reason: `策略模板「${blockedByTemplate.template.name}」阻断命令模式: ${blockedByTemplate.pattern}`,
      };
    }

    const matched = this.rules.find((rule) => (
      rule.adapters.includes(input.adapterKey) &&
      (!rule.operations || rule.operations.includes(input.operationKey)) &&
      rule.pattern.test(step.command)
    ));

    if (matched) {
      return {
        stepKey: step.key,
        label: step.label,
        command: step.command,
        status: 'allowed',
        ruleKey: matched.key,
        reason: matched.description,
      };
    }

    const allowedByTemplate = this.findTemplatePatternMatch(
      templates,
      'allowedPatterns',
      step.command,
    );
    if (allowedByTemplate) {
      return {
        stepKey: step.key,
        label: step.label,
        command: step.command,
        status: 'allowed',
        ruleKey: `template-allow:${allowedByTemplate.template.id}`,
        reason: `策略模板「${allowedByTemplate.template.name}」允许命令模式: ${allowedByTemplate.pattern}`,
      };
    }

    return {
      stepKey: step.key,
      label: step.label,
      command: step.command,
      status: 'blocked',
      ruleKey: 'no-allowlist-match',
      reason: `命令未匹配 Server executor 白名单: ${input.adapterKey}/${input.operationKey}/${step.key}`,
    };
  }

  private async loadMatchingTemplates(input: ServerExecutionInput): Promise<PolicyTemplateRecord[]> {
    const projectId = this.readMetadataString(input.metadata, 'projectId');
    const environmentId = this.readMetadataString(input.metadata, 'environmentId');
    const scope: Prisma.ServerCommandPolicyTemplateWhereInput[] = [
      { projectId: null, environmentId: null },
    ];

    if (projectId) {
      scope.push({ projectId, environmentId: null });
    }
    if (environmentId) {
      scope.push({ environmentId });
    }

    const templates = await this.prisma.serverCommandPolicyTemplate.findMany({
      where: {
        teamId: input.teamId,
        enabled: true,
        OR: scope,
      },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        name: true,
        adapterKeys: true,
        operationKeys: true,
        allowedPatterns: true,
        blockedPatterns: true,
      },
    });

    return templates.filter((template) => (
      this.matchesStringList(template.adapterKeys, input.adapterKey) &&
      this.matchesStringList(template.operationKeys, input.operationKey)
    ));
  }

  private findTemplatePatternMatch(
    templates: PolicyTemplateRecord[],
    field: 'allowedPatterns' | 'blockedPatterns',
    command: string,
  ): { template: PolicyTemplateRecord; pattern: string } | undefined {
    for (const template of templates) {
      for (const pattern of this.readStringList(template[field])) {
        const regex = this.compilePattern(pattern);
        if (regex?.test(command)) {
          return { template, pattern };
        }
      }
    }
    return undefined;
  }

  private async assertTemplateBindings(
    teamId: string,
    projectId?: string | null,
    environmentId?: string | null,
  ) {
    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, teamId },
        select: { id: true },
      });
      if (!project) {
        throw new NotFoundException('项目不存在或不属于当前团队');
      }
    }

    if (!environmentId) {
      return;
    }

    const environment = await this.prisma.projectEnvironment.findFirst({
      where: { id: environmentId, teamId, status: 'active' },
      select: { id: true, projectId: true },
    });
    if (!environment) {
      throw new NotFoundException('项目环境不存在或不属于当前团队');
    }
    if (projectId && environment.projectId !== projectId) {
      throw new BadRequestException('项目环境必须属于所选项目');
    }
  }

  private assertPatterns(patterns: string[]) {
    for (const pattern of this.cleanStringList(patterns)) {
      if (!this.compilePattern(pattern)) {
        throw new BadRequestException(`命令策略模板包含无效正则: ${pattern}`);
      }
    }
  }

  private matchesStringList(value: Prisma.JsonValue | null, needle?: string) {
    if (!needle) return true;
    const list = this.readStringList(value);
    return list.length === 0 || list.includes(needle);
  }

  private toStringListJson(values?: string[] | null): Prisma.InputJsonValue {
    return this.cleanStringList(values);
  }

  private cleanStringList(values?: string[] | null): string[] {
    if (!Array.isArray(values)) return [];
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
  }

  private readStringList(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) return [];
    return this.cleanStringList(value.filter((item): item is string => typeof item === 'string'));
  }

  private readMetadataString(
    metadata: ServerExecutionInput['metadata'],
    key: string,
  ): string | undefined {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
    const value = metadata[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private compilePattern(pattern: string): RegExp | undefined {
    try {
      return new RegExp(pattern);
    } catch {
      return undefined;
    }
  }
}
