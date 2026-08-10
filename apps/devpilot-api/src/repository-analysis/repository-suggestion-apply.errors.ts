export class RepositoryIntakeSnapshotLockedError extends Error {
  constructor() {
    super('repository intake review snapshot is immutable');
    this.name = 'RepositoryIntakeSnapshotLockedError';
  }
}
