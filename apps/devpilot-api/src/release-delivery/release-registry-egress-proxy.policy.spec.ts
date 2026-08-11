import { authorizeRegistryConnect } from "./release-registry-egress-proxy.policy";

describe("registry egress proxy policy", () => {
  it("allows only the exact public registry CONNECT target", () => {
    expect(authorizeRegistryConnect({
      requestLine: "CONNECT registry.npmjs.org:443 HTTP/1.1",
      headers: "Host: registry.npmjs.org:443", addresses: ["104.16.1.35"],
    })).toBe("104.16.1.35");
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
});
