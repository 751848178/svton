import { useTranslations } from 'next-intl';
import { Input, Select } from '@/components/ui';
import type { ProjectDirectoryStatusFilter } from '../types';

interface DirectoryToolbarProps {
  search: string;
  status: ProjectDirectoryStatusFilter;
  total: number;
  onSearch: (value: string) => void;
  onStatus: (value: ProjectDirectoryStatusFilter) => void;
}

export function DirectoryToolbar(props: DirectoryToolbarProps) {
  const t = useTranslations('projects');
  return (
    <div className="flex flex-col gap-3 border-b bg-card p-4 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <label
          className="sr-only"
          htmlFor="project-directory-search"
        >
          {t('directorySearchPlaceholder')}
        </label>
        <Input
          className="min-h-11"
          id="project-directory-search"
          type="search"
          value={props.search}
          onChange={(event) => props.onSearch(event.target.value)}
          placeholder={t('directorySearchPlaceholder')}
        />
      </div>
      <div className="w-full lg:w-48">
        <label
          className="sr-only"
          htmlFor="project-directory-status"
        >
          {t('statusFilter')}
        </label>
        <Select
          className="min-h-11"
          id="project-directory-status"
          value={props.status}
          onChange={(event) => props.onStatus(event.target.value as ProjectDirectoryStatusFilter)}
          options={[
            { label: t('filterAllStatuses'), value: 'all' },
            { label: t('statusOnline'), value: 'online' },
            { label: t('statusNeedsConfiguration'), value: 'needs_configuration' },
          ]}
        />
      </div>
      <p
        className="whitespace-nowrap text-sm text-muted-foreground"
        aria-live="polite"
      >
        {t('directoryResultCount', { count: props.total })}
      </p>
    </div>
  );
}
