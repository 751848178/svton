import React from 'react';
import { cn, useI18n } from '@svton/ui';

export interface StartupViewState {
  phase: 'loading' | 'ready' | 'noConfiguration' | 'error';
  source: string;
  cause?: string;
}

export interface StartupStateViewProps {
  state: StartupViewState;
  onRetry?: () => void;
  onConfigure?: () => void;
  className?: string;
}

/** Shared in-place startup surface for AgentApp, Web, Desktop, and provider failures. */
export function StartupStateView({
  state,
  onRetry,
  onConfigure,
  className,
}: StartupStateViewProps) {
  const { translate: t } = useI18n();
  if (state.phase === 'ready') return null;
  if (state.phase === 'loading') {
    return (
      <div
        role="status"
        data-testid="startup-loading"
        className={cn('flex h-screen items-center justify-center bg-black text-sm text-gray-400', className)}
      >
        {t('startup.loading')}
      </div>
    );
  }
  const needsConfiguration = state.phase === 'noConfiguration';
  return (
    <div className={cn('flex h-screen items-center justify-center bg-black px-6 text-gray-100', className)}>
      <div
        role={needsConfiguration ? 'status' : 'alert'}
        data-testid={needsConfiguration ? 'startup-no-configuration' : 'startup-error'}
        className="w-full max-w-md rounded-lg border border-[#333] bg-[#171717] p-5"
      >
        <h1 className="text-sm font-medium">
          {t(needsConfiguration ? 'startup.configurationTitle' : 'startup.failureTitle')}
        </h1>
        <p className="mt-2 text-xs text-gray-400">
          {state.cause || (needsConfiguration
            ? t('startup.configurationBody')
            : t('startup.sourceFailure', { source: state.source }))}
        </p>
        <div className="mt-4 flex gap-2">
          {needsConfiguration && onConfigure && (
            <button
              type="button"
              data-testid="startup-configure"
              onClick={onConfigure}
              className="rounded-md bg-cyan-600 px-3 py-1.5 text-xs text-white hover:bg-cyan-500"
            >
              {t('startup.configure')}
            </button>
          )}
          {!needsConfiguration && onRetry && (
            <button
              type="button"
              data-testid="startup-retry"
              onClick={onRetry}
              className="rounded-md bg-cyan-600 px-3 py-1.5 text-xs text-white hover:bg-cyan-500"
            >
              {t('action.retry')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
