import type {
  DetectedService,
  RepositoryInventory,
  RepositoryMigrationEvidence,
} from "./repository-parser.types";

const MIGRATION_FILE =
  /(?:^|\/)(?:migrations?|db\/migrate|prisma\/schema\.prisma|liquibase|flyway)(?:\/|$)/i;

export function detectRepositoryMigrationEvidence(
  inventory: RepositoryInventory,
  services: DetectedService[],
): RepositoryMigrationEvidence {
  const detectedFiles = inventory.files.filter((file) =>
    MIGRATION_FILE.test(file),
  );
  const commandServices = services
    .filter((service) => Boolean(service.commands.migrate))
    .map((service) => service.key);
  const databaseKinds = [
    ...new Set(services.flatMap((service) => service.databases)),
  ].sort();
  const applicable =
    detectedFiles.length > 0 ||
    commandServices.length > 0 ||
    databaseKinds.length > 0;
  return {
    providerKey: "repository_inventory_v1",
    applicable,
    reasonCode: applicable
      ? "migration_surface_detected"
      : "no_schema_or_migration_surface",
    detectedFiles,
    commandServices,
    databaseKinds,
  };
}
