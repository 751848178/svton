import {
  isPublicSiteProbeAddress,
  parseSiteProbeTarget,
} from "./site-probe-target.policy";

describe("site probe target policy", () => {
  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.0.0.1",
    "192.0.2.1",
    "192.168.1.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "240.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "64:ff9b::1",
    "100::1",
    "2001:2::1",
    "2001:db8::1",
    "2002::1",
    "3fff::1",
    "fc00::1",
    "fd00::1",
    "fe80::1",
    "ff00::1",
  ])("rejects non-global address %s", (address) => {
    expect(isPublicSiteProbeAddress(address)).toBe(false);
  });

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
    "accepts global address %s",
    (address) => expect(isPublicSiteProbeAddress(address)).toBe(true),
  );

  it.each([
    ["ftp://example.com/", "SITE_PROBE_PROTOCOL_FORBIDDEN"],
    ["http://user:secret@example.com/", "SITE_PROBE_CREDENTIALS_FORBIDDEN"],
    ["https://example.com/#internal", "SITE_PROBE_FRAGMENT_FORBIDDEN"],
    ["https://EXAMPLE.com/", "SITE_PROBE_URL_NONCANONICAL"],
    ["https://example.com./", "SITE_PROBE_URL_NONCANONICAL"],
    ["http://example.com:22/", "SITE_PROBE_PORT_FORBIDDEN"],
    ["https://example.com:25/", "SITE_PROBE_PORT_FORBIDDEN"],
  ])("rejects unsafe URL %s", (value, code) => {
    expect(() => parseSiteProbeTarget(value)).toThrow(
      expect.objectContaining({ code }),
    );
  });

  it("returns the canonical transport identity", () => {
    expect(parseSiteProbeTarget("https://example.com:8443/release?q=1")).toEqual({
      url: "https://example.com:8443/release?q=1",
      protocol: "https:",
      hostname: "example.com",
      port: 8443,
      hostHeader: "example.com:8443",
      path: "/release?q=1",
    });
  });
});
