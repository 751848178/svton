'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { usePersistFn } from '@svton/hooks';

interface SidebarItem {
  href: string;
  labelKey: string;
}

interface SidebarSection {
  titleKey: string;
  items: SidebarItem[];
}

const sidebarItems: SidebarSection[] = [
  {
    titleKey: 'sectionProjects',
    items: [
      { href: '/projects/new', labelKey: 'createProject' },
      { href: '/projects', labelKey: 'myProjects' },
      { href: '/applications', labelKey: 'applications' },
    ],
  },
  {
    titleKey: 'sectionInfrastructure',
    items: [
      { href: '/servers', labelKey: 'servers' },
      { href: '/resource-control', labelKey: 'resourceControl' },
      { href: '/backups', labelKey: 'backups' },
      { href: '/monitoring', labelKey: 'monitoring' },
      { href: '/logs', labelKey: 'logs' },
      { href: '/execution-governance', labelKey: 'executionGovernance' },
      { href: '/execution-policies', labelKey: 'executionPolicies' },
      { href: '/sites', labelKey: 'sites' },
      { href: '/proxy-configs', labelKey: 'proxyConfigs' },
      { href: '/cdn-configs', labelKey: 'cdnConfigs' },
    ],
  },
  {
    titleKey: 'sectionResources',
    items: [
      { href: '/resources', labelKey: 'resourceCredentials' },
      { href: '/resource-requests', labelKey: 'resourceRequests' },
      { href: '/resource-instances', labelKey: 'resourceInstances' },
      { href: '/keys', labelKey: 'keys' },
    ],
  },
  {
    titleKey: 'sectionConfig',
    items: [
      { href: '/presets', labelKey: 'presets' },
      { href: '/git', labelKey: 'git' },
      { href: '/audit-events', labelKey: 'auditEvents' },
      { href: '/operation-approvals', labelKey: 'operationApprovals' },
      { href: '/access-policies', labelKey: 'accessPolicies' },
    ],
  },
  {
    titleKey: 'sectionTeam',
    items: [{ href: '/teams', labelKey: 'teamManagement' }],
  },
  {
    titleKey: 'sectionAdmin',
    items: [
      { href: '/admin/resource-pools', labelKey: 'resourcePools' },
      { href: '/admin/resource-types', labelKey: 'resourceTypes' },
    ],
  },
];

export function Sidebar() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-background">
      <div className="space-y-4 py-4">
        {sidebarItems.map((section) => (
          <div
            key={section.titleKey}
            className="px-3 py-2"
          >
            <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">{t(section.titleKey)}</h2>
            <div className="space-y-1">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-md px-4 py-2 text-sm font-medium transition-colors',
                    pathname === item.href
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  {t(item.labelKey)}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
