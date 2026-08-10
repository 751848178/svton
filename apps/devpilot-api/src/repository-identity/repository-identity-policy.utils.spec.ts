import type { RepositoryConnection } from "@prisma/client";
import {
  assertIdentityCandidate,
  assertStoredConnection,
  isStoredConnectionAligned,
} from "./repository-identity-policy.utils";
import type { RepositoryIdentityState } from "./repository-identity.types";

describe("repository identity policy", () => {
  it("allows transport aliases only for the same server-derived identity and branch", () => {
    expect(() => assertIdentityCandidate(identity(), {
      repositoryUrl: "git@github.com:Example/Service.git",
      provider: "github",
      branch: "main",
    })).not.toThrow();
  });

  it("rejects cross-repository and forged-provider candidates", () => {
    expectCode(() => assertIdentityCandidate(identity(), {
      repositoryUrl: "https://github.com/example/other.git",
      provider: "github",
      branch: "main",
    }), "PROJECT_REPOSITORY_IDENTITY_LOCKED");
    expectCode(() => assertIdentityCandidate(identity(), {
      repositoryUrl: "https://github.com/example/service.git",
      provider: "gitlab",
      branch: "main",
    }), "PROJECT_REPOSITORY_PROVIDER_DRIFT");
  });

  it("rejects missing or cross-owned current revisions before network access", () => {
    expectCode(() => assertIdentityCandidate(identity({ currentRevision: null }), {
      repositoryUrl: "https://github.com/example/service.git",
      provider: "github",
      branch: "main",
    }), "PROJECT_REPOSITORY_IDENTITY_MIGRATION_REQUIRED");
    const crossed = identity();
    crossed.currentRevision!.identityId = "identity-other";
    expectCode(() => assertIdentityCandidate(crossed, {
      repositoryUrl: "https://github.com/example/service.git",
      provider: "github",
      branch: "main",
    }), "PROJECT_REPOSITORY_REVISION_OWNERSHIP_DRIFT");
  });

  it("requires canonical URL/provider and both stored branches to remain aligned", () => {
    const stored = connection();
    expect(isStoredConnectionAligned(identity(), stored)).toBe(true);
    expect(isStoredConnectionAligned(
      identity({ canonicalUrl: "https://github.com/example/tampered" }),
      stored,
    )).toBe(false);
    expect(isStoredConnectionAligned(identity(), {
      ...stored,
      selectedBranch: "release",
    })).toBe(false);
    expectCode(() => assertStoredConnection(identity(), {
      ...stored,
      provider: "gitlab",
    }), "PROJECT_REPOSITORY_CONNECTION_DRIFT");
  });
});

function identity(
  overrides: Partial<RepositoryIdentityState> = {},
): RepositoryIdentityState {
  return {
    id: "identity-1",
    projectId: "project-1",
    provider: "github",
    canonicalKey: "github.com/example/service",
    canonicalUrl: "https://github.com/example/service",
    lockedAt: new Date(),
    currentRevision: {
      id: "revision-1",
      identityId: "identity-1",
      projectId: "project-1",
      revision: 1,
      defaultBranch: "main",
      reason: "initial",
      createdAt: new Date(),
    },
    ...overrides,
  };
}

function connection(): RepositoryConnection {
  return {
    id: "connection-1",
    teamId: "team-1",
    projectId: "project-1",
    connectedById: null,
    gitConnectionId: null,
    teamCredentialId: null,
    provider: "github",
    repositoryUrl: "git@github.com:example/service.git",
    visibility: "public",
    credentialSource: "none",
    externalRepositoryId: null,
    defaultBranch: "main",
    selectedBranch: "main",
    commitSha: "a".repeat(40),
    branches: null,
    status: "connected",
    verifiedAt: new Date(),
    lastAppliedRunId: null,
    appliedAt: null,
    errorCode: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function expectCode(action: () => unknown, code: string) {
  try {
    action();
    throw new Error("expected repository identity error");
  } catch (error) {
    expect((error as { response?: { code?: string } }).response?.code).toBe(code);
  }
}
