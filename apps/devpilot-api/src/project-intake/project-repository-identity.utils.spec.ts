import { normalizeRepositoryIdentity } from "./project-repository-identity.utils";

describe("normalizeRepositoryIdentity", () => {
  it.each([
    "https://GitHub.com/Example/Service.git",
    "git@github.com:example/service.git",
    "ssh://git@github.com/example/service.git",
  ])("normalizes Git transport aliases for %s", (repositoryUrl) => {
    expect(normalizeRepositoryIdentity(repositoryUrl)).toEqual({
      canonicalKey: "github.com/example/service",
      canonicalUrl: "https://github.com/example/service",
    });
  });

  it.each(["file:///tmp/example/service.git", "/tmp/example/service.git"])(
    "normalizes local repository aliases for isolated verification",
    (repositoryUrl) => {
      expect(normalizeRepositoryIdentity(repositoryUrl)).toEqual({
        canonicalKey: "local/tmp/example/service",
        canonicalUrl: "file:///tmp/example/service",
      });
    },
  );

  it.each([undefined, null, "", "not a repository"])(
    "rejects missing or unparseable identities",
    (repositoryUrl) => {
      expect(normalizeRepositoryIdentity(repositoryUrl)).toBeNull();
    },
  );
});
