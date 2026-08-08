import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createNetServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer as createTlsServer } from "node:tls";
import { probeTlsForFinalUrl } from "./site-final-probe.service";
import {
  probeFinalTls,
  type FinalTlsProbeOptions,
} from "./site-final-tls-probe";

interface TestCertificates {
  ca: Buffer;
  expiredCert: Buffer;
  leafCert: Buffer;
  leafKey: Buffer;
  selfSignedCert: Buffer;
  selfSignedKey: Buffer;
}

describe("final site TLS proof", () => {
  const directory = mkdtempSync(join(tmpdir(), "devpilot-final-tls-"));
  const servers: Server[] = [];
  let certificates: TestCertificates;

  beforeAll(() => {
    certificates = generateCertificates(directory);
  });

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(closeServer));
  });

  afterAll(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("accepts a trusted CA certificate for the exact hostname", async () => {
    const server = await listenTls(certificates.leafKey, certificates.leafCert);
    const result = await probe(server, "localhost", certificates.ca);

    expect(result).toMatchObject({
      status: "valid",
      host: "localhost",
      servername: "localhost",
      authorized: true,
      authorizationErrorCode: null,
      peerAddress: "127.0.0.1",
      cert: {
        subject: expect.stringContaining("localhost"),
        issuer: expect.stringContaining("Devpilot Test CA"),
        expired: false,
        fingerprint256: expect.stringMatching(/^([0-9A-F]{2}:)+[0-9A-F]{2}$/),
      },
    });
  });

  it("classifies an untrusted self-signed certificate as invalid", async () => {
    const server = await listenTls(
      certificates.selfSignedKey,
      certificates.selfSignedCert,
    );
    const result = await probe(server, "localhost", certificates.ca);

    expect(result).toMatchObject({
      status: "invalid",
      authorized: false,
      authorizationErrorCode: "DEPTH_ZERO_SELF_SIGNED_CERT",
      error: { code: "DEPTH_ZERO_SELF_SIGNED_CERT" },
    });
  });

  it("classifies a trusted certificate for the wrong hostname as invalid", async () => {
    const server = await listenTls(certificates.leafKey, certificates.leafCert);
    const result = await probe(server, "wrong.example.test", certificates.ca);

    expect(result).toMatchObject({
      status: "invalid",
      servername: "wrong.example.test",
      authorized: false,
      authorizationErrorCode: "ERR_TLS_CERT_ALTNAME_INVALID",
      error: { code: "ERR_TLS_CERT_ALTNAME_INVALID" },
      cert: {
        issuer: expect.stringContaining("Devpilot Test CA"),
        fingerprint256: expect.any(String),
      },
    });
  });

  it("classifies an expired certificate from the trusted CA as invalid", async () => {
    const server = await listenTls(
      certificates.leafKey,
      certificates.expiredCert,
    );
    const result = await probe(server, "localhost", certificates.ca);

    expect(result).toMatchObject({
      status: "invalid",
      authorized: false,
      authorizationErrorCode: "CERT_HAS_EXPIRED",
      error: { code: "CERT_HAS_EXPIRED" },
      cert: { expired: true },
    });
  });

  it("classifies a refused connection as unavailable", async () => {
    const port = await closedPort();
    const result = await probeFinalTls("localhost", 200, {
      connectHost: "127.0.0.1",
      port,
      ca: certificates.ca,
    });

    expect(result).toMatchObject({
      status: "unavailable",
      authorizationErrorCode: null,
      error: { code: "ECONNREFUSED" },
    });
  });

  it("does not open a TLS socket when TLS is explicitly not required", async () => {
    const probeMock = jest.fn(async () => {
      throw new Error("TLS probe must not run");
    });

    await expect(
      probeTlsForFinalUrl(
        "http://example.test/",
        false,
        100,
        probeMock as unknown as typeof probeFinalTls,
      ),
    ).resolves.toMatchObject({
      status: "not_required",
      host: "example.test",
      port: null,
      servername: null,
    });
    expect(probeMock).not.toHaveBeenCalled();
  });

  it("uses the normalized final URL hostname and port as TLS identity", async () => {
    const probeMock = jest.fn(async () => ({
      status: "valid",
      checkedAt: new Date().toISOString(),
    }));

    await probeTlsForFinalUrl(
      "https://BÜCHER.example:8443/release",
      true,
      123,
      probeMock as unknown as typeof probeFinalTls,
    );

    expect(probeMock).toHaveBeenCalledWith("xn--bcher-kva.example", 123, {
      port: 8443,
    });
  });

  async function listenTls(key: Buffer, cert: Buffer): Promise<Server> {
    return new Promise((resolve) => {
      const server = createTlsServer({ key, cert }, (socket) => socket.end());
      server.listen(0, "127.0.0.1", () => {
        servers.push(server);
        resolve(server);
      });
    });
  }
});

function probe(server: Server, hostname: string, ca: Buffer) {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no TLS port");
  const options: FinalTlsProbeOptions = {
    ca,
    connectHost: "127.0.0.1",
    port: address.port,
  };
  return probeFinalTls(hostname, 1000, options);
}

async function closedPort(): Promise<number> {
  const server = await new Promise<Server>((resolve) => {
    const candidate = createNetServer();
    candidate.listen(0, "127.0.0.1", () => resolve(candidate));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no TCP port");
  await closeServer(server);
  return address.port;
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function generateCertificates(directory: string): TestCertificates {
  const file = (name: string) => join(directory, name);
  run(directory, [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", "ca.key", "-out", "ca.crt", "-days", "2",
    "-subj", "/CN=Devpilot Test CA/O=Devpilot Test",
  ]);
  run(directory, [
    "req", "-new", "-newkey", "rsa:2048", "-nodes",
    "-keyout", "leaf.key", "-out", "leaf.csr", "-subj", "/CN=localhost",
  ]);
  writeFileSync(file("leaf.ext"), [
    "subjectAltName=DNS:localhost", "basicConstraints=CA:FALSE",
    "keyUsage=digitalSignature,keyEncipherment", "extendedKeyUsage=serverAuth",
  ].join("\n"));
  run(directory, [
    "x509", "-req", "-in", "leaf.csr", "-CA", "ca.crt", "-CAkey", "ca.key",
    "-CAcreateserial", "-out", "leaf.crt", "-days", "2", "-sha256",
    "-extfile", "leaf.ext",
  ]);
  run(directory, [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", "self.key", "-out", "self.crt", "-days", "2",
    "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost",
  ]);
  writeExpiredCaConfig(directory);
  run(directory, [
    "ca", "-batch", "-config", "ca.cnf", "-in", "leaf.csr",
    "-out", "expired.crt", "-notext", "-startdate", "200101000000Z",
    "-enddate", "200102000000Z",
  ]);
  return {
    ca: readFileSync(file("ca.crt")),
    expiredCert: readFileSync(file("expired.crt")),
    leafCert: readFileSync(file("leaf.crt")),
    leafKey: readFileSync(file("leaf.key")),
    selfSignedCert: readFileSync(file("self.crt")),
    selfSignedKey: readFileSync(file("self.key")),
  };
}

function writeExpiredCaConfig(directory: string) {
  mkdirSync(join(directory, "newcerts"));
  writeFileSync(join(directory, "index.txt"), "");
  writeFileSync(join(directory, "serial"), "1000\n");
  writeFileSync(join(directory, "ca.cnf"), `
[ca]
default_ca=issuer
[issuer]
database=${directory}/index.txt
new_certs_dir=${directory}/newcerts
certificate=${directory}/ca.crt
private_key=${directory}/ca.key
serial=${directory}/serial
default_md=sha256
policy=policy_any
unique_subject=no
x509_extensions=server_cert
[policy_any]
commonName=supplied
[server_cert]
subjectAltName=DNS:localhost
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
`);
}

function run(directory: string, args: string[]) {
  execFileSync("openssl", args, { cwd: directory, stdio: "ignore" });
}
