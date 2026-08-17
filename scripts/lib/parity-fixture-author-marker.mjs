export const PARITY_FIXTURE_MARKER_VERSION = 2;

export function parityFixtureGitEnvironment(actor, stamp, environment) {
  return {
    ...environment,
    GIT_AUTHOR_NAME: actor.name,
    GIT_AUTHOR_EMAIL: actor.email,
    GIT_AUTHOR_DATE: stamp,
    GIT_COMMITTER_NAME: actor.name,
    GIT_COMMITTER_EMAIL: actor.email,
    GIT_COMMITTER_DATE: stamp,
  };
}

export function parityFixtureMarker(input) {
  return {
    schemaVersion: PARITY_FIXTURE_MARKER_VERSION,
    pinnedCommit: input.pinnedCommit,
    commitAuthorEmail: input.commitAuthorEmail,
    source: input.source,
    materializedAt: input.materializedAt,
  };
}

export function isCurrentParityFixtureMarker(value, authorEmail) {
  return value?.schemaVersion === PARITY_FIXTURE_MARKER_VERSION &&
    value?.commitAuthorEmail === authorEmail &&
    typeof value?.pinnedCommit === "string" &&
    /^[a-f0-9]{40}$/.test(value.pinnedCommit);
}
