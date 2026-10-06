'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Checkbox, Modal } from '@/components/ui';
import type { EnvironmentAccessPolicy } from './settings-policy.types';

export function SettingsPolicySelectionModal(props: {
  policies: EnvironmentAccessPolicy[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(props.value);
  const begin = () => {
    setDraft(props.value);
    setOpen(true);
  };
  const toggle = (id: string, checked: boolean) =>
    setDraft((current) =>
      checked ? [...new Set([...current, id])] : current.filter((item) => item !== id),
    );
  const apply = () => {
    props.onChange(draft);
    setOpen(false);
  };
  return (
    <>
      <Button
        variant="outline"
        className="min-h-11"
        onClick={begin}
      >
        {t('envAccessConfigurePolicies')}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('envAccessConfigurePolicies')}
        description={t('envAccessPolicyDescription')}
        width={640}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              {tc('cancel')}
            </Button>
            <Button onClick={apply}>{t('envAccessApplyPolicies')}</Button>
          </>
        }
      >
        <div className="space-y-2">
          {props.policies.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('envAccessNoPoliciesAvailable')}</p>
          ) : (
            props.policies.map((policy) => (
              <label
                key={policy.id}
                className="flex min-h-11 items-start gap-3 rounded-md border p-3 text-sm"
              >
                <Checkbox
                  className="mt-0.5"
                  checked={draft.includes(policy.id)}
                  onChange={(event) => toggle(policy.id, event.target.checked)}
                />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{policy.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {t(policy.effect === 'deny' ? 'envAccessEffectDeny' : 'envAccessEffectAllow')}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {policy.actions?.length
                      ? t('envAccessActions', { actions: policy.actions.join(', ') })
                      : t('envAccessAllMatchingActions')}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {policy.categories?.length
                      ? t('envAccessCategories', { categories: policy.categories.join(', ') })
                      : t('envAccessAllCategories')}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>
      </Modal>
    </>
  );
}
