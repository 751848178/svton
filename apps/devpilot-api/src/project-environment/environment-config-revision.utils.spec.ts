import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { CreateEnvironmentConfigRevisionDto } from "./dto/environment-config-revision.dto";
import { EnvironmentConfigReferenceResolverService } from "./environment-config-reference-resolver.service";
import {
  hashEnvironmentConfigSnapshot,
  normalizePlainVariables,
  normalizeResourceReferences,
  normalizeRouteSnapshot,
} from "./environment-config-revision.utils";

describe("environment config revision governance", () => {
  it("creates a stable hash independent of object key order", () => {
    const left = {
      plainVariables: { B: "2", A: "1" },
      secretReferences: [], resourceReferences: [], routeSnapshot: {}, policyReferences: [],
    };
    const right = {
      plainVariables: { A: "1", B: "2" },
      secretReferences: [], resourceReferences: [], routeSnapshot: {}, policyReferences: [],
    };
    expect(hashEnvironmentConfigSnapshot(left)).toBe(hashEnvironmentConfigSnapshot(right));
  });

  it("rejects invalid plain variable names and incomplete sharing declarations", () => {
    expect(() => normalizePlainVariables({ "bad-key": "value" })).toThrow(BadRequestException);
    expect(() => normalizeResourceReferences([{ kind: "site", id: "site-1", risk: "medium" }]))
      .toThrow(BadRequestException);
  });

  it("normalizes a single transport wrapper around resource records", () => {
    expect(normalizeResourceReferences([[{
      kind: "site", id: "site-1", sharedEnvironmentIds: ["env-1"],
      risk: "low", impact: "current environment",
    }]])).toHaveLength(1);
  });

  it("preserves explicit component and resource env mappings", () => {
    expect(normalizeResourceReferences([{
      kind: "resource_instance", id: "db-1", sharedEnvironmentIds: ["env-1"],
      risk: "medium", impact: "database", componentKey: "api",
      envBindings: [{ sourceKey: "DATABASE_URL", targetEnvKey: "API_DATABASE_URL" }],
    }])[0]).toMatchObject({
      componentKey: "api",
      envBindings: [{ sourceKey: "DATABASE_URL", targetEnvKey: "API_DATABASE_URL" }],
    });
  });

  it("preserves object entries through the global validation contract", async () => {
    const pipe = new ValidationPipe({
      whitelist: true, transform: true, forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    });
    const result = await pipe.transform({
      resourceReferences: [{
        kind: "managed_resource", id: "resource-1",
        sharedEnvironmentIds: ["env-1", "env-2"], risk: "medium", impact: "both",
      }],
    }, { type: "body", metatype: CreateEnvironmentConfigRevisionDto });
    expect(result.resourceReferences?.[0]).toMatchObject({ kind: "managed_resource", id: "resource-1" });
  });

  it("resolves only safe Secret metadata and explicit shared resource impact", async () => {
    const tx = {
      secretKey: {
        findMany: jest.fn().mockResolvedValue([{ id: "secret-1", name: "API_TOKEN", type: "api_key" }]),
      },
      projectEnvironment: {
        findMany: jest.fn().mockResolvedValue([{ id: "env-1" }, { id: "env-2" }]),
      },
      managedResource: {
        findFirst: jest.fn().mockResolvedValue({ id: "resource-1", name: "Shared Redis", environmentId: "env-1" }),
      },
      resourceInstance: { findFirst: jest.fn() },
      site: { findFirst: jest.fn() },
      cDNConfig: { findFirst: jest.fn() },
      controlAccessPolicy: {
        findMany: jest.fn().mockResolvedValue([{ id: "policy-1", name: "Production", effect: "allow", actions: [] }]),
      },
    };
    const resolver = new EnvironmentConfigReferenceResolverService();
    const result = await resolver.resolve(tx as never, {
      id: "env-1", teamId: "team-1", projectId: "project-1",
    }, {
      plainVariables: { NODE_ENV: "production" },
      secretReferenceIds: ["secret-1"],
      resourceReferences: [{
        kind: "managed_resource", id: "resource-1",
        sharedEnvironmentIds: ["env-1", "env-2"], risk: "medium", impact: "Both baselines",
      }],
      routeSnapshot: { domains: ["app.example.com"], tlsRequired: true },
      policyReferenceIds: ["policy-1"],
    }, null);

    expect(result.secretReferences).toEqual([{ id: "secret-1", name: "API_TOKEN", type: "api_key" }]);
    expect(tx.secretKey.findMany.mock.calls[0][0].select).toEqual({ id: true, name: true, type: true });
    expect(result.resourceReferences[0]).toMatchObject({
      id: "resource-1", sharedEnvironmentIds: ["env-1", "env-2"],
      risk: "medium", impact: "Both baselines",
    });
  });

  it("rejects a low-risk declaration for a resource shared across environments", async () => {
    const tx = {
      secretKey: { findMany: jest.fn().mockResolvedValue([]) },
      projectEnvironment: {
        findMany: jest.fn().mockResolvedValue([{ id: "env-1" }, { id: "env-2" }]),
      },
      managedResource: { findFirst: jest.fn() },
      resourceInstance: { findFirst: jest.fn() },
      site: { findFirst: jest.fn() },
      cDNConfig: { findFirst: jest.fn() },
      controlAccessPolicy: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const resolver = new EnvironmentConfigReferenceResolverService();
    await expect(resolver.resolve(tx as never, {
      id: "env-1", teamId: "team-1", projectId: "project-1",
    }, {
      resourceReferences: [{
        kind: "managed_resource", id: "resource-1",
        sharedEnvironmentIds: ["env-1", "env-2"], risk: "low", impact: "shared",
      }],
    }, null)).rejects.toThrow("风险不能为 low");
  });
});

describe("normalizeRouteSnapshot per-entry model (F448 AC-SET-042/043/046)", () => {
  it("round-trips structured entries with component/port/path/tlsMode", () => {
    const result = normalizeRouteSnapshot({
      domains: ["staging.picshare.example.com", "media.picshare.example.com"],
      dnsProvider: "cloudflare",
      tlsRequired: true,
      proxyTarget: "web:3000",
      entries: [
        { domain: "staging.picshare.example.com", path: "/", component: "web", port: 3000, tlsMode: "managed_cert" },
        { domain: "media.picshare.example.com", path: "/v1", component: "api", port: 8080, tlsMode: "existing_cert_asset" },
      ],
    });
    expect(result.entries).toEqual([
      { domain: "staging.picshare.example.com", path: "/", serviceId: null, component: "web", port: 3000, tlsMode: "managed_cert" },
      { domain: "media.picshare.example.com", path: "/v1", serviceId: null, component: "api", port: 8080, tlsMode: "existing_cert_asset" },
    ]);
    expect(result.domains).toEqual(["media.picshare.example.com", "staging.picshare.example.com"]);
    expect(result.tlsRequired).toBe(true);
    expect(result.proxyTarget).toBe("web:3000");
  });

  it("defaults path/tlsMode and keeps the legacy flat fields for backward compat", () => {
    const result = normalizeRouteSnapshot({
      domains: ["demo.f437.example"],
      proxyTarget: "web : 3000",
      entries: [{ domain: "demo.f437.example", component: "web", port: 3000 }],
    });
    expect(result.entries).toEqual([
      { domain: "demo.f437.example", path: "/", serviceId: null, component: "web", port: 3000, tlsMode: "managed_cert" },
    ]);
    expect(result.domains).toEqual(["demo.f437.example"]);
  });

  it("derives entries from the legacy domains[] when entries are absent", () => {
    const result = normalizeRouteSnapshot({
      domains: ["demo.f437.example"],
      proxyTarget: "http://127.0.0.1:23992",
      tlsRequired: true,
    });
    expect(result.entries).toEqual([
      { domain: "demo.f437.example", path: "/", serviceId: null, component: "", port: null, tlsMode: "managed_cert" },
    ]);
  });

  it("extracts component:port from a legacy component-style proxyTarget", () => {
    const result = normalizeRouteSnapshot({
      domains: ["app.example.com"],
      proxyTarget: "api:8080",
    });
    expect(result.entries[0]).toMatchObject({ component: "api", port: 8080, path: "/" });
  });

  it("rejects malformed entries (missing domain / bad port / bad tlsMode / non-array)", () => {
    expect(() => normalizeRouteSnapshot({
      domains: ["a.example.com"], entries: [{ path: "/" }],
    })).toThrow(BadRequestException);
    expect(() => normalizeRouteSnapshot({
      domains: ["a.example.com"], entries: [{ domain: "a.example.com", port: 70000 }],
    })).toThrow(BadRequestException);
    expect(() => normalizeRouteSnapshot({
      domains: ["a.example.com"], entries: [{ domain: "a.example.com", tlsMode: "unknown" }],
    })).toThrow(BadRequestException);
    expect(() => normalizeRouteSnapshot({
      domains: ["a.example.com"], entries: "nope",
    })).toThrow(BadRequestException);
  });

  it("hashes differently when entries change while the legacy flat fields stay identical", () => {
    const base = {
      plainVariables: {}, secretReferences: [], resourceReferences: [],
      policyReferences: [],
    };
    const left = {
      ...base,
      routeSnapshot: normalizeRouteSnapshot({
        domains: ["a.example.com"], proxyTarget: "web:3000",
        entries: [{ domain: "a.example.com", component: "web", port: 3000 }],
      }),
    };
    const right = {
      ...base,
      routeSnapshot: normalizeRouteSnapshot({
        domains: ["a.example.com"], proxyTarget: "web:3000",
        entries: [{ domain: "a.example.com", component: "api", port: 8080 }],
      }),
    };
    expect(hashEnvironmentConfigSnapshot(left)).not.toBe(
      hashEnvironmentConfigSnapshot(right),
    );
  });
});
