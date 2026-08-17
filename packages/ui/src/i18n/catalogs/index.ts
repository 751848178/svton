import { auxiliaryEnCatalog } from './auxiliary.en';
import { auxiliaryZhCatalog } from './auxiliary.zh';
import { chatEnCatalog } from './chat.en';
import { chatZhCatalog } from './chat.zh';
import { chatRuntimeEnCatalog } from './chat-runtime.en';
import { chatRuntimeZhCatalog } from './chat-runtime.zh';
import { artifactEnCatalog } from './artifact.en';
import { artifactZhCatalog } from './artifact.zh';
import { chatDecisionsEnCatalog } from './chat-decisions.en';
import { chatDecisionsZhCatalog } from './chat-decisions.zh';
import { settingsEnCatalog, settingsEnCatalogs } from './settings.en';
import { settingsZhCatalog, settingsZhCatalogs } from './settings.zh';
import { sharedEnCatalog } from './shared.en';
import { sharedZhCatalog } from './shared.zh';
import { sharedSessionEnCatalog } from './shared-session.en';
import { sharedSessionZhCatalog } from './shared-session.zh';
import { timelineEnCatalog } from './timeline.en';
import { timelineZhCatalog } from './timeline.zh';

export const enCatalogDomains = [
  chatEnCatalog,
  chatRuntimeEnCatalog,
  artifactEnCatalog,
  chatDecisionsEnCatalog,
  sharedEnCatalog,
  sharedSessionEnCatalog,
  timelineEnCatalog,
  ...settingsEnCatalogs,
  auxiliaryEnCatalog,
] as const;

export const zhCatalogDomains = [
  chatZhCatalog,
  chatRuntimeZhCatalog,
  artifactZhCatalog,
  chatDecisionsZhCatalog,
  sharedZhCatalog,
  sharedSessionZhCatalog,
  timelineZhCatalog,
  ...settingsZhCatalogs,
  auxiliaryZhCatalog,
] as const;

function composeCatalog(domains: readonly Readonly<Record<string, string>>[]) {
  const result: Record<string, string> = {};
  for (const domain of domains) {
    for (const [key, value] of Object.entries(domain)) {
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        throw new Error(`Duplicate translation key: ${key}`);
      }
      result[key] = value;
    }
  }
  return result;
}

const typedEnCatalog = {
  ...chatEnCatalog,
  ...chatRuntimeEnCatalog,
  ...artifactEnCatalog,
  ...chatDecisionsEnCatalog,
  ...sharedEnCatalog,
  ...sharedSessionEnCatalog,
  ...timelineEnCatalog,
  ...settingsEnCatalog,
  ...auxiliaryEnCatalog,
};

export type TranslationKey = keyof typeof typedEnCatalog;
export const enCatalog: Readonly<Record<TranslationKey, string>> = composeCatalog(enCatalogDomains) as Record<TranslationKey, string>;
export const zhCatalog: Readonly<Record<TranslationKey, string>> = composeCatalog(zhCatalogDomains) as Record<TranslationKey, string>;

export const catalogs = { en: enCatalog, zh: zhCatalog } as const;
