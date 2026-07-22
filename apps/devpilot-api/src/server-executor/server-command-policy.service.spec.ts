import { PrismaService } from "../prisma/prisma.service";
import { ServerCommandPolicyService } from "./server-command-policy.service";
import { ServerCommandPolicyTemplateMatcherService } from "./server-command-policy-template-matcher.service";
import { ServerCommandPolicyTemplateRepository } from "./server-command-policy-template.repository";
import { ServerCommandPolicyTemplateService } from "./server-command-policy-template.service";

describe("ServerCommandPolicyService built-in rules", () => {
  it("allows the bounded docker stats JSON snapshot command", async () => {
    const prisma = {
      serverCommandPolicyTemplate: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = createService(prisma as unknown as PrismaService);

    const result = await service.evaluate({
      teamId: "team-1",
      userId: "user-1",
      operationKey: "docker.container.stats",
      adapterKey: "server-resource-script-plan",
      dryRun: false,
      target: { transport: "ssh", serverId: "server-1" },
      steps: [
        {
          key: "docker.container.stats:1",
          label: "read container metrics snapshot",
          command: "docker stats --no-stream --format '{{json .}}' api-1",
          required: true,
          risk: "low",
        },
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "passed",
        mode: "built_in_baseline",
      }),
    );
    expect(result.decisions[0]).toEqual(
      expect.objectContaining({
        status: "allowed",
        ruleKey: "docker-stats-json-snapshot",
      }),
    );
  });

  it("allows the bounded OpenSSL site TLS probe command only for the TLS probe operation", async () => {
    const prisma = {
      serverCommandPolicyTemplate: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = createService(prisma as unknown as PrismaService);
    const command =
      "echo | openssl s_client -servername api.example.com -connect api.example.com:443 2>/dev/null | openssl x509 -noout -subject -issuer -serial -dates -fingerprint -sha256";

    const result = await service.evaluate({
      teamId: "team-1",
      userId: "user-1",
      operationKey: "site.tls_probe",
      adapterKey: "nginx-site-plan",
      dryRun: false,
      target: { transport: "ssh", serverId: "server-1" },
      steps: [
        {
          key: "probe_tls_certificate",
          label: "probe tls",
          command,
          required: true,
          risk: "low",
        },
      ],
    });

    expect(result.status).toBe("passed");
    expect(result.decisions[0]).toEqual(
      expect.objectContaining({
        status: "allowed",
        ruleKey: "openssl-site-tls-probe",
      }),
    );

    const wrongOperation = await service.evaluate({
      teamId: "team-1",
      userId: "user-1",
      operationKey: "site.sync",
      adapterKey: "nginx-site-plan",
      dryRun: false,
      target: { transport: "ssh", serverId: "server-1" },
      steps: [
        {
          key: "probe_tls_certificate",
          label: "probe tls",
          command,
          required: true,
          risk: "low",
        },
      ],
    });

    expect(wrongOperation.status).toBe("blocked");
    expect(wrongOperation.decisions[0]).toEqual(
      expect.objectContaining({
        ruleKey: "no-allowlist-match",
      }),
    );
  });

  it("allows bounded certbot renew commands only for the TLS renewal operation", async () => {
    const prisma = {
      serverCommandPolicyTemplate: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = createService(prisma as unknown as PrismaService);
    const steps = [
      {
        key: "renew_tls_certificate",
        label: "renew tls",
        command:
          "certbot renew --cert-name api.example.com --dry-run --non-interactive",
        required: true,
        risk: "low" as const,
      },
      {
        key: "renew_tls_certificate_live",
        label: "renew tls live",
        command: "certbot renew --cert-name api.example.com --non-interactive",
        required: true,
        risk: "medium" as const,
      },
    ];

    const result = await service.evaluate({
      teamId: "team-1",
      userId: "user-1",
      operationKey: "site.tls_renew",
      adapterKey: "nginx-site-plan",
      dryRun: false,
      target: { transport: "ssh", serverId: "server-1" },
      steps,
    });

    expect(result.status).toBe("passed");
    expect(result.decisions[0]).toEqual(
      expect.objectContaining({
        status: "allowed",
        ruleKey: "certbot-renew-dry-run",
      }),
    );
    expect(result.decisions[1]).toEqual(
      expect.objectContaining({
        status: "allowed",
        ruleKey: "certbot-renew",
      }),
    );

    const wrongOperation = await service.evaluate({
      teamId: "team-1",
      userId: "user-1",
      operationKey: "site.sync",
      adapterKey: "nginx-site-plan",
      dryRun: false,
      target: { transport: "ssh", serverId: "server-1" },
      steps: [steps[1]],
    });

    expect(wrongOperation.status).toBe("blocked");
    expect(wrongOperation.decisions[0]).toEqual(
      expect.objectContaining({
        ruleKey: "no-allowlist-match",
      }),
    );
  });

  it("allows bounded site smoke check curl commands only for the smoke check operation", async () => {
    const prisma = {
      serverCommandPolicyTemplate: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = createService(prisma as unknown as PrismaService);
    const steps = [
      {
        key: "public_domain_smoke",
        label: "public smoke",
        command: "curl -fsS https://api.example.com",
        required: true,
        risk: "low" as const,
      },
      {
        key: "nginx_local_host_smoke",
        label: "local host smoke",
        command: "curl -fsS -H 'Host: api.example.com' http://127.0.0.1/",
        required: false,
        risk: "low" as const,
      },
      {
        key: "upstream_smoke",
        label: "upstream smoke",
        command: "curl -fsS http://upstream-svc:3000",
        required: false,
        risk: "low" as const,
      },
    ];

    const result = await service.evaluate({
      teamId: "team-1",
      userId: "user-1",
      operationKey: "site.smoke_check",
      adapterKey: "nginx-site-plan",
      dryRun: false,
      target: { transport: "ssh", serverId: "server-1" },
      steps,
    });

    expect(result.status).toBe("passed");
    expect(result.decisions[0]).toEqual(
      expect.objectContaining({
        status: "allowed",
        ruleKey: "site-public-smoke-check",
      }),
    );
    expect(result.decisions[1]).toEqual(
      expect.objectContaining({
        status: "allowed",
        ruleKey: "site-local-host-smoke-check",
      }),
    );
    expect(result.decisions[2]).toEqual(
      expect.objectContaining({
        status: "allowed",
        ruleKey: "site-upstream-smoke-check",
      }),
    );

    const wrongOperation = await service.evaluate({
      teamId: "team-1",
      userId: "user-1",
      operationKey: "site.sync",
      adapterKey: "nginx-site-plan",
      dryRun: false,
      target: { transport: "ssh", serverId: "server-1" },
      steps,
    });

    expect(wrongOperation.status).toBe("blocked");
    expect(wrongOperation.decisions[0]).toEqual(
      expect.objectContaining({
        ruleKey: "no-allowlist-match",
      }),
    );
  });

  it("allows bounded deployment smoke check curl commands only for deployment health operations", async () => {
    const prisma = {
      serverCommandPolicyTemplate: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = createService(prisma as unknown as PrismaService);
    const step = {
      key: "deployment_smoke_check",
      label: "deployment smoke",
      command: "curl -fsS https://api.example.com/health",
      required: true,
      risk: "low" as const,
    };

    const result = await service.evaluate({
      teamId: "team-1",
      userId: "user-1",
      operationKey: "deployment.smoke_check",
      adapterKey: "deployment-script-plan",
      dryRun: false,
      target: { transport: "ssh", serverId: "server-1" },
      steps: [step],
    });

    expect(result.status).toBe("passed");
    expect(result.decisions[0]).toEqual(
      expect.objectContaining({
        status: "allowed",
        ruleKey: "curl-health-check",
      }),
    );

    const wrongOperation = await service.evaluate({
      teamId: "team-1",
      userId: "user-1",
      operationKey: "deployment.unrelated",
      adapterKey: "deployment-script-plan",
      dryRun: false,
      target: { transport: "ssh", serverId: "server-1" },
      steps: [step],
    });

    expect(wrongOperation.status).toBe("blocked");
    expect(wrongOperation.decisions[0]).toEqual(
      expect.objectContaining({
        ruleKey: "no-allowlist-match",
      }),
    );
  });

  it("allows bounded OpenResty status commands only for the OpenResty status operation", async () => {
    const prisma = {
      serverCommandPolicyTemplate: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = createService(prisma as unknown as PrismaService);
    const steps = [
      {
        key: "nginx_config_test_status",
        label: "nginx config test",
        command: "nginx -t 2>&1 || true",
        required: false,
        risk: "low" as const,
      },
      {
        key: "nginx_build_info",
        label: "nginx build info",
        command: "nginx -V 2>&1 || true",
        required: false,
        risk: "low" as const,
      },
      {
        key: "openresty_build_info",
        label: "openresty build info",
        command: "openresty -V 2>&1 || true",
        required: false,
        risk: "low" as const,
      },
      {
        key: "nginx_service_status",
        label: "nginx service",
        command: "systemctl is-active nginx || true",
        required: false,
        risk: "low" as const,
      },
      {
        key: "openresty_service_status",
        label: "openresty service",
        command: "systemctl is-active openresty || true",
        required: false,
        risk: "low" as const,
      },
      {
        key: "nginx_openresty_process_status",
        label: "process summary",
        command:
          "ps -eo pid,comm,args | grep -E 'nginx|openresty' | grep -v grep | head -20 || true",
        required: false,
        risk: "low" as const,
      },
    ];

    const result = await service.evaluate({
      teamId: "team-1",
      userId: "user-1",
      operationKey: "site.openresty_status",
      adapterKey: "nginx-site-plan",
      dryRun: false,
      target: { transport: "ssh", serverId: "server-1" },
      steps,
    });

    expect(result.status).toBe("passed");
    expect(result.decisions.map((decision) => decision.ruleKey)).toEqual([
      "nginx-config-test-status",
      "nginx-version-status",
      "openresty-version-status",
      "nginx-service-active-status",
      "openresty-service-active-status",
      "nginx-openresty-process-status",
    ]);

    const wrongOperation = await service.evaluate({
      teamId: "team-1",
      userId: "user-1",
      operationKey: "site.sync",
      adapterKey: "nginx-site-plan",
      dryRun: false,
      target: { transport: "ssh", serverId: "server-1" },
      steps,
    });

    expect(wrongOperation.status).toBe("blocked");
    expect(wrongOperation.decisions[0]).toEqual(
      expect.objectContaining({
        ruleKey: "no-allowlist-match",
      }),
    );
  });

  it("allows bounded OpenResty module inventory commands only for the OpenResty modules operation", async () => {
    const prisma = {
      serverCommandPolicyTemplate: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = createService(prisma as unknown as PrismaService);
    const steps = [
      {
        key: "nginx_module_config_args",
        label: "nginx module args",
        command: "nginx -V 2>&1 || true",
        required: false,
        risk: "low" as const,
      },
      {
        key: "openresty_module_config_args",
        label: "openresty module args",
        command: "openresty -V 2>&1 || true",
        required: false,
        risk: "low" as const,
      },
      {
        key: "nginx_dynamic_module_files",
        label: "dynamic modules",
        command:
          "find /etc/nginx/modules-enabled /usr/lib/nginx/modules /usr/local/openresty/nginx/modules -maxdepth 1 -type f -name '*.so' -print 2>/dev/null | sort || true",
        required: false,
        risk: "low" as const,
      },
    ];

    const result = await service.evaluate({
      teamId: "team-1",
      userId: "user-1",
      operationKey: "site.openresty_modules",
      adapterKey: "nginx-site-plan",
      dryRun: false,
      target: { transport: "ssh", serverId: "server-1" },
      steps,
    });

    expect(result.status).toBe("passed");
    expect(result.decisions.map((decision) => decision.ruleKey)).toEqual([
      "nginx-module-config-args",
      "openresty-module-config-args",
      "nginx-dynamic-module-files",
    ]);

    const wrongOperation = await service.evaluate({
      teamId: "team-1",
      userId: "user-1",
      operationKey: "site.sync",
      adapterKey: "nginx-site-plan",
      dryRun: false,
      target: { transport: "ssh", serverId: "server-1" },
      steps,
    });

    expect(wrongOperation.status).toBe("blocked");
    expect(wrongOperation.decisions[0]).toEqual(
      expect.objectContaining({
        ruleKey: "no-allowlist-match",
      }),
    );
  });

  it("allows bounded OpenResty module baseline commands only for the OpenResty module baseline operation", async () => {
    const prisma = {
      serverCommandPolicyTemplate: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = createService(prisma as unknown as PrismaService);
    const steps = [
      {
        key: "baseline_tls_module",
        label: "tls baseline",
        command:
          "(nginx -V 2>&1 || true; openresty -V 2>&1 || true) | grep -Eq -- '--with-http_ssl_module|--with-openssl' && echo 'present: tls' || echo 'missing: tls'",
        required: false,
        risk: "low" as const,
      },
      {
        key: "baseline_http2_module",
        label: "http2 baseline",
        command:
          "(nginx -V 2>&1 || true; openresty -V 2>&1 || true) | grep -Eq -- '--with-http_v2_module|--with-http_v3_module' && echo 'present: http2_or_http3' || echo 'missing: http2_or_http3'",
        required: false,
        risk: "low" as const,
      },
      {
        key: "baseline_realip_module",
        label: "realip baseline",
        command:
          "(nginx -V 2>&1 || true; openresty -V 2>&1 || true) | grep -Eq -- '--with-http_realip_module' && echo 'present: realip' || echo 'missing: realip'",
        required: false,
        risk: "low" as const,
      },
      {
        key: "baseline_stub_status_module",
        label: "stub status baseline",
        command:
          "(nginx -V 2>&1 || true; openresty -V 2>&1 || true) | grep -Eq -- '--with-http_stub_status_module' && echo 'present: stub_status' || echo 'missing: stub_status'",
        required: false,
        risk: "low" as const,
      },
      {
        key: "baseline_stream_module",
        label: "stream baseline",
        command:
          "(nginx -V 2>&1 || true; openresty -V 2>&1 || true) | grep -Eq -- '--with-stream' && echo 'present: stream' || echo 'missing: stream'",
        required: false,
        risk: "low" as const,
      },
      {
        key: "baseline_lua_module",
        label: "lua baseline",
        command:
          "(nginx -V 2>&1 || true; openresty -V 2>&1 || true; find /etc/nginx/modules-enabled /usr/lib/nginx/modules /usr/local/openresty/nginx/modules -maxdepth 1 -type f -name '*.so' -print 2>/dev/null || true) | grep -Eiq 'http_lua|lua-nginx|ngx_http_lua|lua.*\\.so' && echo 'present: lua' || echo 'missing: lua'",
        required: false,
        risk: "low" as const,
      },
    ];

    const result = await service.evaluate({
      teamId: "team-1",
      userId: "user-1",
      operationKey: "site.openresty_module_baseline",
      adapterKey: "nginx-site-plan",
      dryRun: false,
      target: { transport: "ssh", serverId: "server-1" },
      steps,
    });

    expect(result.status).toBe("passed");
    expect(result.decisions.map((decision) => decision.ruleKey)).toEqual([
      "openresty-baseline-tls",
      "openresty-baseline-http2",
      "openresty-baseline-realip",
      "openresty-baseline-stub-status",
      "openresty-baseline-stream",
      "openresty-baseline-lua",
    ]);

    const wrongOperation = await service.evaluate({
      teamId: "team-1",
      userId: "user-1",
      operationKey: "site.sync",
      adapterKey: "nginx-site-plan",
      dryRun: false,
      target: { transport: "ssh", serverId: "server-1" },
      steps,
    });

    expect(wrongOperation.status).toBe("blocked");
    expect(wrongOperation.decisions[0]).toEqual(
      expect.objectContaining({
        ruleKey: "no-allowlist-match",
      }),
    );
  });

  it("matches command policy template patterns as micromatch globs", async () => {
    const prisma = {
      serverCommandPolicyTemplate: {
        findMany: jest.fn().mockResolvedValue([
          commandPolicyTemplate({
            id: "template-allow",
            name: "Kubernetes readonly",
            allowedPatterns: ["kubectl get pods -n *"],
          }),
          commandPolicyTemplate({
            id: "template-block",
            name: "Kubernetes destructive",
            blockedPatterns: ["kubectl delete **"],
          }),
        ]),
      },
    };
    const service = createService(prisma as unknown as PrismaService);

    const result = await service.evaluate({
      teamId: "team-1",
      userId: "user-1",
      operationKey: "custom.kubernetes",
      adapterKey: "custom-policy-plan",
      dryRun: false,
      target: { transport: "ssh", serverId: "server-1" },
      steps: [
        {
          key: "read_pods",
          label: "read pods",
          command: "kubectl get pods -n prod",
          required: true,
          risk: "low",
        },
        {
          key: "delete_pod",
          label: "delete pod",
          command: "kubectl delete pod/api-1 -n prod",
          required: true,
          risk: "high",
        },
      ],
    });

    expect(result.status).toBe("blocked");
    expect(result.decisions[0]).toEqual(
      expect.objectContaining({
        status: "allowed",
        ruleKey: "template-allow:template-allow",
      }),
    );
    expect(result.decisions[1]).toEqual(
      expect.objectContaining({
        status: "blocked",
        ruleKey: "template-block:template-block",
      }),
    );
  });

  it("keeps regex-prefixed command policy template patterns compatible", async () => {
    const prisma = {
      serverCommandPolicyTemplate: {
        findMany: jest.fn().mockResolvedValue([
          commandPolicyTemplate({
            id: "template-regex",
            name: "Legacy regex",
            allowedPatterns: ["regex:^custom-tool --id=\\d+$"],
          }),
        ]),
      },
    };
    const service = createService(prisma as unknown as PrismaService);

    const result = await service.evaluate({
      teamId: "team-1",
      userId: "user-1",
      operationKey: "custom.legacy",
      adapterKey: "custom-policy-plan",
      dryRun: false,
      target: { transport: "ssh", serverId: "server-1" },
      steps: [
        {
          key: "legacy_tool",
          label: "legacy tool",
          command: "custom-tool --id=42",
          required: true,
          risk: "low",
        },
      ],
    });

    expect(result.status).toBe("passed");
    expect(result.decisions[0]).toEqual(
      expect.objectContaining({
        status: "allowed",
        ruleKey: "template-allow:template-regex",
      }),
    );
  });
});

function commandPolicyTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: "template-1",
    name: "Template",
    adapterKeys: [],
    operationKeys: [],
    allowedPatterns: [],
    blockedPatterns: [],
    ...overrides,
  };
}

function createService(prisma: PrismaService) {
  const repository = new ServerCommandPolicyTemplateRepository(prisma);
  const templateService = new ServerCommandPolicyTemplateService(repository);
  const templateMatcher = new ServerCommandPolicyTemplateMatcherService(
    repository,
  );
  return new ServerCommandPolicyService(templateService, templateMatcher);
}
