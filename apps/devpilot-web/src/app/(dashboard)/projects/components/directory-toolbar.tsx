import { useTranslations } from 'next-intl';
import { TableFilterBar, TableFilterSearch, TableFilterSelect } from '@/components/ui';
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
    <TableFilterBar
      actions={
        <p
          className="whitespace-nowrap text-sm text-muted-foreground"
          aria-live="polite"
        >
          {t('directoryResultCount', { count: props.total })}
        </p>
      }
    >
      <TableFilterSearch
        value={props.search}
        onChange={(event) => props.onSearch(event.target.value)}
        placeholder={t('directorySearchPlaceholder')}
        aria-label={t('directorySearchPlaceholder')}
      />
      <TableFilterSelect
        value={props.status}
        onChange={(event) => props.onStatus(event.target.value as ProjectDirectoryStatusFilter)}
        aria-label={t('statusFilter')}
        options={[
          { label: t('filterAllStatuses'), value: 'all' },
          { label: t('statusOnline'), value: 'online' },
          { label: t('statusNeedsConfiguration'), value: 'needs_configuration' },
        ]}
      />
    </TableFilterBar>
  );
}
