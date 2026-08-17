import { expect, test, type Page } from '@playwright/test';
import { appReady, enqueueResponses, lastAssistant, responses, seedE2e, send } from './helpers';
import { captureResponsiveEvidence, installBrowserDiagnostics } from './responsive-evidence.helpers';

test.describe.configure({ mode: 'serial' });

async function openSidebar(page: Page) {
  await page.getByRole('button', { name: 'Open conversation navigation' }).click();
  const drawer = page.getByRole('dialog', { name: 'Svton', exact: true });
  await expect(drawer).toBeVisible();
  return drawer;
}

async function openSettings(page: Page) {
  const trigger = page.getByRole('button', { name: 'Open conversation navigation' });
  if (await trigger.isVisible().catch(() => false)) {
    const drawer = await openSidebar(page);
    await drawer.getByRole('button', { name: 'Settings', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
  }
  await expect(page.getByTestId('settings-shell')).toBeVisible();
  await expect(page.locator('[data-responsive-frame-toolbar]')).toHaveCount(0);
}

async function selectSettingsSection(page: Page, id: string, label: string) {
  const select = page.getByRole('combobox', { name: 'Settings category' });
  if (await select.isVisible().catch(() => false)) await select.selectOption(id);
  else await page.getByRole('button', { name: label, exact: true }).click();
}

test('responsive shell covers empty, populated, drawer and menu states', async ({ page }) => {
  const diagnostics = installBrowserDiagnostics(page);
  await seedE2e(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await appReady(page);
  await expect(page.getByTestId('responsive-agent-frame')).toHaveAttribute('data-responsive-band', 'compact');
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 320);
  await captureResponsiveEvidence(page, 'web-320-empty-sidebar-closed', { expectedBand: 'compact', diagnostics });
  await openSidebar(page);
  await captureResponsiveEvidence(page, 'web-320-empty-sidebar-open', { expectedBand: 'compact', diagnostics });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open conversation navigation' })).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await enqueueResponses(page, [responses.text('Responsive evidence response')]);
  await send(page, 'Populate responsive evidence');
  await expect(lastAssistant(page)).toContainText('Responsive evidence response');
  await captureResponsiveEvidence(page, 'web-390-populated-sidebar-closed', { expectedBand: 'compact', diagnostics });
  const drawer = await openSidebar(page);
  const manage = drawer.getByRole('button', { name: /^Manage / }).first();
  await expect(manage).toBeVisible();
  await manage.click();
  const menuItems = page.getByRole('menuitem');
  await expect(menuItems).toHaveCount(4);
  await expect(menuItems.first()).toBeFocused();
  const dialogBox = await drawer.boundingBox();
  for (const item of await menuItems.all()) {
    await expect(item).toBeVisible();
    const box = await item.boundingBox();
    expect(box && dialogBox
      && box.x >= dialogBox.x && box.x + box.width <= dialogBox.x + dialogBox.width
      && box.y >= dialogBox.y && box.y + box.height <= dialogBox.y + dialogBox.height).toBe(true);
    expect(await page.evaluate(({ x, y }) =>
      document.elementFromPoint(x, y)?.closest('[role="menuitem"]') !== null,
    { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 })).toBe(true);
  }
  await page.keyboard.press('ArrowUp');
  await expect(menuItems.last()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menuItems.first()).toBeFocused();
  await captureResponsiveEvidence(page, 'web-390-populated-sidebar-menu', { expectedBand: 'compact', diagnostics });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem')).toHaveCount(0);
  await expect(drawer).toBeVisible();
  await expect(manage).toBeFocused();
  await manage.click();
  await page.evaluate(() => document.dispatchEvent(new Event('scroll')));
  await expect(page.getByRole('menuitem')).toHaveCount(0);
  await expect(manage).toBeFocused();
  await manage.click();
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await expect(page.getByRole('menuitem')).toHaveCount(0);
  await expect(manage).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open conversation navigation' })).toBeFocused();
  await expect(drawer).toBeHidden();
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(page.getByTestId('responsive-agent-frame')).toHaveAttribute('data-responsive-band', 'medium');
  await captureResponsiveEvidence(page, 'web-768-populated-sidebar-closed', { expectedBand: 'medium', diagnostics });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByTestId('responsive-agent-frame')).toHaveAttribute('data-responsive-band', 'wide');
  await captureResponsiveEvidence(page, 'web-1280-populated-persistent-sidebar', { expectedBand: 'wide', diagnostics });
  await page.setViewportSize({ width: 1440, height: 900 });
  await captureResponsiveEvidence(page, 'web-1440-populated-persistent-sidebar', { expectedBand: 'wide', diagnostics });
});

test('Settings owns one responsive navigation and long MCP list', async ({ page }) => {
  const diagnostics = installBrowserDiagnostics(page);
  await seedE2e(page);
  await page.addInitScript(() => {
    const servers = Array.from({ length: 12 }, (_, index) => ({
      name: `evidence-server-${String(index + 1).padStart(2, '0')}`,
      transport: 'http', url: `https://mcp-${index + 1}.example.test`, enabled: false,
    }));
    localStorage.setItem('agent-web:mcp_servers', JSON.stringify(servers));
  });
  await page.setViewportSize({ width: 320, height: 720 });
  await appReady(page);
  await openSettings(page);
  await expect(page.getByRole('combobox', { name: 'Settings category' })).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'Settings category' })).toHaveCount(0);
  await captureResponsiveEvidence(page, 'web-settings-320-general', { expectedBand: 'compact', diagnostics });

  await page.setViewportSize({ width: 390, height: 844 });
  await selectSettingsSection(page, 'providers', 'Providers');
  await captureResponsiveEvidence(page, 'web-settings-390-providers', { expectedBand: 'compact', diagnostics });
  await page.setViewportSize({ width: 768, height: 900 });
  await selectSettingsSection(page, 'permissions', 'Permissions');
  await captureResponsiveEvidence(page, 'web-settings-768-permissions', { expectedBand: 'medium', diagnostics });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('combobox', { name: 'Settings category' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Settings category' })).toHaveCount(1);
  await selectSettingsSection(page, 'mcp', 'MCP servers');
  const lastServer = page.getByText('evidence-server-12');
  await expect(lastServer).toBeVisible();
  await captureResponsiveEvidence(page, 'web-settings-1440-long-mcp', { expectedBand: 'wide', diagnostics });
  await lastServer.scrollIntoViewIfNeeded();
  await captureResponsiveEvidence(page, 'web-settings-1440-long-mcp-bottom', { expectedBand: 'wide', diagnostics });
});
