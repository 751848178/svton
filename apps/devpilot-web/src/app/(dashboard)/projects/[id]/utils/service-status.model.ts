/**
 * 服务/组件状态值 → 本地化标签 key（避免 StatusTag 回退显示英文原值）。
 * applications-panel 与 project-component-table 共用；新增状态值时在此补充。
 */
export function getServiceStatusLabelKey(status: string): string {
  const s = status.toLowerCase();
  if (s === 'active') return 'serviceStatusActive';
  if (s === 'inactive') return 'serviceStatusInactive';
  if (s === 'online') return 'serviceStatusOnline';
  if (s === 'offline') return 'serviceStatusOffline';
  return 'serviceStatusUnknown';
}
