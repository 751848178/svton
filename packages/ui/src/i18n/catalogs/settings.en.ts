import { settingsCoreEnCatalog } from './settings-core.en';
import { settingsNavigationEnCatalog } from './settings-navigation.en';
import { settingsAutomationEnCatalog } from './settings-automation.en';
import { settingsExtensionsEnCatalog } from './settings-extensions.en';
import { settingsFeedbackEnCatalog } from './settings-feedback.en';

export const settingsEnCatalogs = [settingsNavigationEnCatalog, settingsCoreEnCatalog, settingsAutomationEnCatalog, settingsExtensionsEnCatalog, settingsFeedbackEnCatalog] as const;
export const settingsEnCatalog = {
  ...settingsNavigationEnCatalog,
  ...settingsCoreEnCatalog,
  ...settingsAutomationEnCatalog,
  ...settingsExtensionsEnCatalog,
  ...settingsFeedbackEnCatalog,
} as const;
