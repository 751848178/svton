'use client';

import { useTranslations } from 'next-intl';
import { Select } from '@/components/ui';
import type { ProjectEnvironment } from '../../types';

export function EnvironmentSettingsScopeSelector(props: {
  environments: ProjectEnvironment[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const t = useTranslations('projects');
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {t('currentEnvironmentLabel')}
      </span>
      <Select
        className="h-11 w-full min-w-0 bg-background lg:h-[38px]"
        value={props.selected}
        onChange={(event) => props.onSelect(event.target.value)}
      >
        {props.environments.map((environment) => (
          <option
            key={environment.id}
            value={environment.key}
          >
            {environment.name} ({environment.key})
          </option>
        ))}
      </Select>
    </label>
  );
}
