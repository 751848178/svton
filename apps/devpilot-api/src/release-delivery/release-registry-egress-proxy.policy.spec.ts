import { authorizeRegistryConnect } from "./release-registry-egress-proxy.policy";

describe("registry egress proxy policy", () => {
  it("allows only the exact public registry CONNECT target", () => {
    expect(authorizeRegistryConnect({
      requestLine: "CONNECT registry.npmjs.org:443 HTTP/1.1",
      headers: "Host: registry.npmjs.org:443", addresses: ["104.16.1.35"],
    })).toBe("104.16.1.35");
    expect(authorizeRegistryConnect({
      requestLine: "CONNECT registry.npmjs.org:443 HTTP/1.1", headers: "",
      addresses: ["2606:4700::6810:123"] })).toBe("2606:4700::6810:123");
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
    "ff02::1", "64:ff9b::1", "100::1", "2001:db8::1", "2002::1"])
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
});
