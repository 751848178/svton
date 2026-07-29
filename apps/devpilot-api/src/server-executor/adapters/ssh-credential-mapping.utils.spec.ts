import {
  toSshTransportCredentials,
  mapAuthTypeToTransportField,
  isSupportedSshAuthType,
  buildUnsupportedAuthTypeMessage,
  describeSupportedAuthTypes,
  SshCredentialMappingError,
} from "./ssh-credential-mapping.utils";

describe("ssh-credential-mapping.utils", () => {
  const baseCreds = (authType: string, credentials: string) => ({
    host: "10.0.0.10",
    port: 22,
    username: "deploy",
    authType,
    credentials,
  });

  describe("mapAuthTypeToTransportField", () => {
    it("maps key -> privateKey", () => {
      expect(mapAuthTypeToTransportField("key")).toBe("privateKey");
    });
    it("maps password -> password", () => {
      expect(mapAuthTypeToTransportField("password")).toBe("password");
    });
    it("fails closed on unknown authType with actionable message", () => {
      expect(() => mapAuthTypeToTransportField("otp")).toThrow(
        SshCredentialMappingError,
      );
      expect(() => mapAuthTypeToTransportField("otp")).toThrow(
        /不支持认证类型「otp」/,
      );
    });
    it("fails closed on empty/null/undefined authType", () => {
      for (const v of ["", null, undefined] as const) {
        expect(() => mapAuthTypeToTransportField(v)).toThrow(
          SshCredentialMappingError,
        );
      }
    });
  });

  describe("isSupportedSshAuthType", () => {
    it.each(["key", "password"])("accepts %s", (t) => {
      expect(isSupportedSshAuthType(t)).toBe(true);
    });
    it.each(["otp", "", null, undefined, "KEY"])("rejects %p", (t) => {
      expect(isSupportedSshAuthType(t)).toBe(false);
    });
  });

  describe("toSshTransportCredentials", () => {
    it("routes key auth into privateKey and omits password", () => {
      const out = toSshTransportCredentials(baseCreds("key", "PRIVATE-PEM"));
      expect(out.privateKey).toBe("PRIVATE-PEM");
      expect(out.password).toBeUndefined();
      expect(out).toMatchObject({ host: "10.0.0.10", port: 22, username: "deploy" });
    });

    it("routes password auth into password and omits privateKey", () => {
      const out = toSshTransportCredentials(baseCreds("password", "s3cret"));
      expect(out.password).toBe("s3cret");
      expect(out.privateKey).toBeUndefined();
    });

    it("never places the secret into both fields", () => {
      const pw = toSshTransportCredentials(baseCreds("password", "s3cret"));
      expect(pw.privateKey).toBeUndefined();
      const key = toSshTransportCredentials(baseCreds("key", "PEM"));
      expect(key.password).toBeUndefined();
    });

    it("fails closed on unknown authType without leaking the secret", () => {
      const creds = baseCreds("otp", "DO-NOT-LEAK-THIS");
      expect(() => toSshTransportCredentials(creds)).toThrow(
        SshCredentialMappingError,
      );
      try {
        toSshTransportCredentials(creds);
        fail("expected throw");
      } catch (e) {
        expect((e as Error).message).not.toContain("DO-NOT-LEAK-THIS");
      }
    });
  });

  describe("messages", () => {
    it("describeSupportedAuthTypes lists key and password", () => {
      expect(describeSupportedAuthTypes()).toBe("key / password");
    });
    it("buildUnsupportedAuthTypeMessage is actionable and lists supported types", () => {
      const msg = buildUnsupportedAuthTypeMessage("otp");
      expect(msg).toContain("otp");
      expect(msg).toContain("key / password");
    });
    it("buildUnsupportedAuthTypeMessage handles empty gracefully", () => {
      const msg = buildUnsupportedAuthTypeMessage("");
      expect(msg).toContain("(空)");
    });
  });
});
