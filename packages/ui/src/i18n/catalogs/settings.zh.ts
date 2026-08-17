import { settingsCoreZhCatalog } from './settings-core.zh';
import { settingsNavigationZhCatalog } from './settings-navigation.zh';
import { settingsAutomationZhCatalog } from './settings-automation.zh';
import { settingsExtensionsZhCatalog } from './settings-extensions.zh';
import { settingsFeedbackZhCatalog } from './settings-feedback.zh';

export const settingsZhCatalogs = [settingsNavigationZhCatalog, settingsCoreZhCatalog, settingsAutomationZhCatalog, settingsExtensionsZhCatalog, settingsFeedbackZhCatalog] as const;
export const settingsZhCatalog = {
  ...settingsNavigationZhCatalog,
  ...settingsCoreZhCatalog,
  ...settingsAutomationZhCatalog,
  ...settingsExtensionsZhCatalog,
  ...settingsFeedbackZhCatalog,
} as const;
