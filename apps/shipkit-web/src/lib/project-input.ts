import type { ProjectPatch, ProjectRegistration } from './contracts';

export interface MetadataFormValues {
  name: string;
  serverName: string;
  targetKey: string;
  services: Array<{ serviceKey: string; displayName: string; entryUrl: string }>;
}
export function registrationInput(values: ProjectRegistration): ProjectRegistration {
  return { ...values, targetKey: values.targetKey?.trim() || undefined, serverName: values.serverName?.trim() || undefined };
}
export function metadataInput(values: MetadataFormValues): ProjectPatch {
  return {
    name: values.name.trim(), serverName: values.serverName.trim() || null, targetKey: values.targetKey.trim() || undefined,
    services: values.services.map(service => ({ serviceKey: service.serviceKey, displayName: service.displayName.trim() || null, entryUrl: service.entryUrl.trim() || null })),
  };
}
