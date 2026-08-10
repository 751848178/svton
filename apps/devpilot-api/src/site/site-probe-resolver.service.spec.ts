import { createPinnedLookup } from "./site-pinned-lookup";
import { SiteProbeResolverService } from "./site-probe-resolver.service";
import type { SiteProbeLookup } from "./site-probe-target.types";
import { ConfigService } from "@nestjs/config";
import { SiteProbeLocalAcceptancePolicy } from "./site-probe-local-acceptance.policy";

describe("site probe one-shot resolver", () => {
  it("resolves once with all/verbatim and selects a pinned endpoint", async () => {
    const lookup = jest.fn(async () => [
      { address: "8.8.8.8", family: 4 as const },
      { address: "2606:4700:4700::1111", family: 6 as const },
    ]);
    const target = await new SiteProbeResolverService(lookup).resolve(
      "https://example.com/",
      100,
    );

    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith("example.com", {
      all: true,
      verbatim: true,
    });
    expect(target).toMatchObject({ address: "8.8.8.8", family: 4 });
  });

  it("rejects an empty answer", async () => {
    const resolver = new SiteProbeResolverService(async () => []);
    await expect(
      resolver.resolve("https://example.com/", 100),
    ).rejects.toMatchObject({
      code: "SITE_PROBE_DNS_EMPTY",
    });
  });

  it("rejects the whole mixed public/private answer set", async () => {
    const resolver = new SiteProbeResolverService(async () => [
      { address: "8.8.8.8", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    await expect(
      resolver.resolve("https://example.com/", 100),
    ).rejects.toMatchObject({
      code: "SITE_PROBE_ADDRESS_FORBIDDEN",
    });
  });

  it("applies the same policy to direct IP literals without DNS", async () => {
    const lookup = jest.fn() as jest.MockedFunction<SiteProbeLookup>;
    const resolver = new SiteProbeResolverService(lookup);

    await expect(
      resolver.resolve("http://127.0.0.1:8080/", 100),
    ).rejects.toMatchObject({
      code: "SITE_PROBE_ADDRESS_FORBIDDEN",
    });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("accepts a private route-control address only through the exact local profile", async () => {
    const lookup = jest.fn(async () => [
      { address: "172.24.0.8", family: 4 as const },
    ]);
    const config = {
      get: (key: string) =>
        ({
          SITE_PROBE_LOCAL_ACCEPTANCE_PROFILE: "parity-hosts-v1",
          SITE_PROBE_LOCAL_ACCEPTANCE_HOSTNAME: "parity.example.test",
          SITE_PROBE_LOCAL_ACCEPTANCE_PORT: "54321",
          PARITY_GOAL_ID: "devpilot-v13-opencode-acceptance",
          PARITY_REQUIRE_VERIFIED_RUNTIME: "1",
          PARITY_RUNTIME_ID: `c5-${"a".repeat(8)}-${"b".repeat(32)}`,
          PARITY_SOURCE_REVISION: "c".repeat(40),
        })[key],
    } as ConfigService;
    const target = await new SiteProbeResolverService(
      lookup,
      new SiteProbeLocalAcceptancePolicy(config),
    ).resolve("http://parity.example.test:54321/", 100);

    expect(target).toMatchObject({
      hostname: "parity.example.test",
      port: 54321,
      address: "172.24.0.8",
    });
  });

  it("cannot rebind because transport lookup is pinned to the first answer", async () => {
    const lookup = jest
      .fn()
      .mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }])
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    const target = await new SiteProbeResolverService(lookup).resolve(
      "https://example.com/",
      100,
    );
    const pinned = createPinnedLookup(target);
    const callback = jest.fn();

    pinned("example.com", { family: 0 }, callback);

    expect(lookup).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(null, "8.8.8.8", 4);

    const allCallback = jest.fn();
    pinned("example.com", { all: true }, allCallback);
    expect(allCallback).toHaveBeenCalledWith(null, [
      { address: "8.8.8.8", family: 4 },
    ]);
  });
});
