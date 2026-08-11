import { acceptDesktopEngineResponse, authorizeRegistryConnect,
  desktopEngineConnectRequest,
  registryProxyUsesPublicDns } from "./release-registry-egress-proxy.policy";

describe("registry egress proxy policy", () => {
  it("allows only the exact public registry CONNECT target", () => {
    expect(authorizeRegistryConnect({
      requestLine: "CONNECT registry.npmjs.org:443 HTTP/1.1",
      headers: "Host: registry.npmjs.org:443", addresses: ["104.16.1.35"],
    })).toBe("104.16.1.35");
    expect(authorizeRegistryConnect({
      requestLine: "CONNECT registry.npmjs.org:443 HTTP/1.1", headers: "",
      addresses: ["2606:4700::6810:123"] })).toBe("2606:4700::6810:123");
    expect(authorizeRegistryConnect({
      requestLine: "CONNECT registry.npmjs.org:443 HTTP/1.1", headers: "",
      addresses: ["3001:db8::1"] })).toBe("3001:db8::1");
  });

  it.each([
    ["CONNECT evil.test:443 HTTP/1.1", "", ["104.16.1.35"]],
    ["CONNECT 127.0.0.1:443 HTTP/1.1", "", ["127.0.0.1"]],
    ["CONNECT registry.npmjs.org:443 HTTP/1.1", "", ["10.0.0.1"]],
    ["CONNECT registry.npmjs.org:443 HTTP/1.1", "Proxy-Authorization: x", ["104.16.1.35"]],
  ])("blocks foreign/private/credential egress", (requestLine, headers, addresses) => {
    expect(() => authorizeRegistryConnect({ requestLine, headers, addresses }))
      .toThrow("registry_egress_blocked");
  });

  it.each(["0.0.0.0", "100.64.0.1", "169.254.1.1", "192.0.2.1",
    "198.18.0.1", "198.51.100.1", "203.0.113.1", "224.0.0.1",
    "::", "::1", "::ffff:192.0.2.1", "fc00::1", "fe80::1", "fec0::1",
    "ff02::1", "64:ff9b::1", "100::1", "2001:db8::1", "2002::1",
    "fe00::1", "4000::1", "2001:20::1", "3fff::1"])
  ("blocks special-use DNS answer %s", (address) => {
    expect(() => authorizeRegistryConnect({
      requestLine: "CONNECT registry.npmjs.org:443 HTTP/1.1", headers: "",
      addresses: [address] })).toThrow("registry_egress_blocked");
  });

  it("rejects DNS rebinding when any returned address is private", () => {
    expect(() => authorizeRegistryConnect({
      requestLine: "CONNECT registry.npmjs.org:443 HTTP/1.1", headers: "",
      addresses: ["104.16.1.35", "10.0.0.1"] }))
      .toThrow("registry_egress_blocked");
  });

  it("uses one credential-free fixed CONNECT for Docker Desktop", () => {
    expect(registryProxyUsesPublicDns("docker-desktop-engine-proxy-v1")).toBe(false);
    expect(registryProxyUsesPublicDns("direct-public-dns-v1")).toBe(true);
    expect(desktopEngineConnectRequest()).toBe(
      "CONNECT registry.npmjs.org:443 HTTP/1.1\r\n"+
      "Host: registry.npmjs.org:443\r\nConnection: keep-alive\r\n\r\n");
    expect(desktopEngineConnectRequest()).not.toMatch(/auth|http\.docker|\/path/i);
    expect(() => acceptDesktopEngineResponse(
      Buffer.from("HTTP/1.1 200 Connection Established\r\n\r\n"))).not.toThrow();
  });

  it.each([
    Buffer.from("HTTP/1.1 407 Proxy Authentication Required\r\n\r\n"),
    Buffer.alloc(4097, 65),
    Buffer.from("HTTP/1.1 200 OK\r\n"),
  ])("rejects non-200, oversized or incomplete desktop response", (response) => {
    expect(() => acceptDesktopEngineResponse(response)).toThrow("registry_egress_blocked");
  });
});
