import { CurrentEnvironmentVersionScope } from "./current-environment-version.utils";
import { currentEnvironmentVersionId } from "./environment-version-read.utils";

const project = { id: "project-1", teamId: "team-1" };

describe("currentEnvironmentVersionId (AC-ENVVER-006)", () => {
  it("returns the pointer id when the pointed version is exactly provable", () => {
    expect(currentEnvironmentVersionId(project, scope(exact()))).toBe("version-1");
  });

  it("fails closed when the pointer does not match the pointed version", () => {
    const environment = scope(exact(), { currentEnvironmentVersionId: "version-stale" });
    expect(currentEnvironmentVersionId(project, environment)).toBeNull();
  });

  it("fails closed when the pointer is null", () => {
    const environment = scope(exact(), { currentEnvironmentVersionId: null });
    expect(currentEnvironmentVersionId(project, environment)).toBeNull();
  });

  it("fails closed when the deployment run is not completed", () => {
    const environment = scope(exact(), {
      currentEnvironmentVersion: run({ status: "failed" }),
    });
    expect(currentEnvironmentVersionId(project, environment)).toBeNull();
  });

  it("fails closed when the deployment run is a dry run", () => {
    const environment = scope(exact(), {
      currentEnvironmentVersion: run({ dryRun: true }),
    });
    expect(currentEnvironmentVersionId(project, environment)).toBeNull();
  });

  it("fails closed when the deployment run source is not release_order", () => {
    const environment = scope(exact(), {
      currentEnvironmentVersion: run({ source: "manual" }),
    });
    expect(currentEnvironmentVersionId(project, environment)).toBeNull();
  });

  it("fails closed when the version points to a foreign environment", () => {
    const environment = scope(exact(), {
      currentEnvironmentVersion: {
        ...exact(),
        environmentId: "environment-foreign",
      },
    });
    expect(currentEnvironmentVersionId(project, environment)).toBeNull();
  });

  it("fails closed when the manifest does not belong to the same release order", () => {
    const environment = scope(exact(), {
      currentEnvironmentVersion: {
        ...exact(),
        artifactManifest: { ...exact().artifactManifest, releaseOrderId: "order-foreign" },
      },
    });
    expect(currentEnvironmentVersionId(project, environment)).toBeNull();
  });
});

type DeploymentRunFixture = {
  id: string;
  teamId: string;
  projectId: string;
  environmentId: string;
  artifactManifestId: string;
  source: string;
  status: string;
  dryRun: boolean;
};

type VersionFixture = {
  id: string;
  teamId: string;
  projectId: string;
  environmentId: string;
  releaseOrderId: string;
  artifactManifestId: string;
  deploymentRunId: string;
  effectiveAt: Date;
  releaseOrder: { id: string; teamId: string; projectId: string; releaseVersion: string };
  artifactManifest: {
    id: string;
    teamId: string;
    projectId: string;
    releaseOrderId: string;
    digest: string;
  };
  deploymentRun: DeploymentRunFixture;
};

function exact(): VersionFixture {
  return {
    id: "version-1",
    teamId: project.teamId,
    projectId: project.id,
    environmentId: "environment-1",
    releaseOrderId: "order-1",
    artifactManifestId: "manifest-1",
    deploymentRunId: "deployment-1",
    effectiveAt: new Date("2026-08-05T00:00:00Z"),
    releaseOrder: {
      id: "order-1",
      teamId: project.teamId,
      projectId: project.id,
      releaseVersion: "2.4.1",
    },
    artifactManifest: {
      id: "manifest-1",
      teamId: project.teamId,
      projectId: project.id,
      releaseOrderId: "order-1",
      digest: "sha256:exact",
    },
    deploymentRun: {
      id: "deployment-1",
      teamId: project.teamId,
      projectId: project.id,
      environmentId: "environment-1",
      artifactManifestId: "manifest-1",
      source: "release_order",
      status: "completed",
      dryRun: false,
    },
  };
}

function run(overrides: Partial<DeploymentRunFixture>) {
  return { ...exact(), deploymentRun: { ...exact().deploymentRun, ...overrides } };
}

function scope(
  version: VersionFixture,
  overrides?: Partial<
    Pick<
      CurrentEnvironmentVersionScope,
      "currentEnvironmentVersionId" | "currentEnvironmentVersion"
    >
  >,
): CurrentEnvironmentVersionScope {
  return {
    id: "environment-1",
    teamId: project.teamId,
    projectId: project.id,
    currentEnvironmentVersionId: version.id,
    currentEnvironmentVersion: version,
    ...overrides,
  };
}
