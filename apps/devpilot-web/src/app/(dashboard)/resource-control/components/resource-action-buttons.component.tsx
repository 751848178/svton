'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import type { useResourceControl } from '../hooks/use-resource-control';
import {
  buildResourceActionKey,
  actionRiskLabelKey,
} from '../resource-action-ui.utils';
import type { ManagedResource, ResourceActionDefinition } from '../types';

type RCHook = ReturnType<typeof useResourceControl>;

export function ResourceActionButtons({
  actions,
  rc,
  resource,
}: {
  actions: ResourceActionDefinition[];
  rc: RCHook;
  resource: ManagedResource;
}) {
  const t = useTranslations('resourceControl');
  const [confirmationText, setConfirmationText] = useState<Record<string, string>>({});

  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      <button
        onClick={() => rc.syncResource(resource)}
        disabled={rc.actingResourceId === `${resource.id}:sync`}
        className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
      >
        {rc.actingResourceId === `${resource.id}:sync` ? t('syncing') : t('sync')}
      </button>
      {actions.map((action) => {
        const actionStateKey = buildResourceActionKey(resource.id, action.key);
        const value = confirmationText[actionStateKey] || '';
        const isActing = rc.actingResourceId === actionStateKey;
        const requiresConfirmation = action.requiresConfirmation && !action.dryRunOnly;
        const canExecute = value.trim() === resource.name;
        return (
          <div
            key={action.key}
            className="space-y-1.5"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium">{action.name}</span>
              <StatusTag
                variant="risk"
                status={action.risk}
                label={t(actionRiskLabelKey(action.risk))}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => rc.runAction(resource, action, { dryRun: true })}
                disabled={isActing}
                className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
              >
                {isActing ? t('executing') : t('dryRun')}
              </button>
              {requiresConfirmation ? (
                <>
                  <input
                    value={value}
                    onChange={(event) =>
                      setConfirmationText((current) => ({
                        ...current,
                        [actionStateKey]: event.target.value,
                      }))
                    }
                    placeholder={resource.name}
                    className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-xs"
                  />
                  <button
                    onClick={() =>
                      rc.runAction(resource, action, {
                        confirmationText: value,
                        dryRun: false,
                      })
                    }
                    disabled={!canExecute || isActing}
                    className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                  >
                    {t('confirmExecute')}
                  </button>
                </>
              ) : !action.dryRunOnly ? (
                <button
                  onClick={() => rc.runAction(resource, action, { dryRun: false })}
                  disabled={isActing}
                  className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                >
                  {t('execute')}
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
