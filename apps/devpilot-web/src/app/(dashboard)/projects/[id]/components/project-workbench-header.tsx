'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, GearSix, GitBranch, GithubLogo } from '@phosphor-icons/react';
import { LinkButton } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { ProjectWorkbenchIdentity } from '../utils/project-workbench-identity.model';
import { projectWorkbenchHeaderNavigation } from '../utils/project-workbench-navigation.model';

/** Shared project identity, project issue, deterministic back, and contextual actions. */
export function ProjectWorkbenchHeader({
  identity,
  issue,
}: {
  identity: ProjectWorkbenchIdentity;
  issue?: ReactNode;
}) {
  const t = useTranslations('projects');
  const pathname = usePathname();
  const base = `/projects/${encodeURIComponent(identity.projectId)}`;
  const navigation = projectWorkbenchHeaderNavigation(identity.projectId, pathname);

  return (
    <div className="min-w-0 bg-background">
      <header className="grid gap-3 pt-3 md:pt-4">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-2 sm:items-center">
            <LinkButton
              href={navigation.back.href}
              variant="ghost"
              size="icon"
              aria-label={t(navigation.back.labelKey)}
              title={t(navigation.back.labelKey)}
              className="shrink-0"
            >
              <ArrowLeft
                size={19}
                aria-hidden="true"
              />
            </LinkButton>
            <div className="min-w-0 flex-1">
              {/* impeccable-disable-next-line design-system-font-size -- documented project headline */}
              <h1 className="truncate text-[24px] font-semibold leading-none tracking-[-0.035em] md:text-[26px]">
                {identity.name}
              </h1>
              <div className="mt-2 flex min-w-0 flex-col items-start gap-1.5 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1">
                <Metadata
                  icon={GithubLogo}
                  value={identity.repository}
                  mono
                />
                <Metadata
                  icon={GitBranch}
                  value={identity.branch}
                />
              </div>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {navigation.contextAction ? (
              <LinkButton
                href={navigation.contextAction.href}
                variant="outline"
                className="flex-1 sm:flex-none"
              >
                <GearSix
                  size={16}
                  aria-hidden="true"
                />
                {t(navigation.contextAction.labelKey)}
              </LinkButton>
            ) : null}
            <LinkButton
              href={`${base}?create=true`}
              className="flex-1 shadow-[0_4px_10px_rgba(79,94,232,.18)] sm:flex-none"
            >
              {t('createReleaseOrder')}
              <ArrowRight
                size={15}
                aria-hidden="true"
              />
            </LinkButton>
          </div>
        </div>
        {issue}
      </header>
    </div>
  );
}

function Metadata({
  icon: Icon,
  value,
  mono = false,
}: {
  icon: typeof GithubLogo;
  value: string | null;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', mono && 'font-mono')}>
      <Icon
        size={14}
        aria-hidden="true"
      />
      <span className="max-w-[36rem] truncate">{value}</span>
    </span>
  );
}
