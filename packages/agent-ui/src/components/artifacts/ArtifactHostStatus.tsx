import type { ArtifactInteraction } from './artifact.types';
import { useI18n } from '@svton/ui';

/** Announces host-only artifact outcomes when no side panel is mounted. */
export function ArtifactHostStatus({ interaction }: { interaction: ArtifactInteraction }) {
  const { translate: t } = useI18n();
  const { active, pending, result } = interaction.state;
  if (active || (!pending && !result)) return null;
  const isAlert = result?.kind === 'failed' || result?.kind === 'unsupported';
  return (
    <div
      role={isAlert ? 'alert' : 'status'}
      aria-live={isAlert ? 'assertive' : 'polite'}
      aria-atomic="true"
      data-artifact-host-status
      className="absolute right-4 top-4 z-30 flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-lg border border-[#454545] bg-[#242424] px-4 py-2 text-xs text-gray-200 shadow-xl"
    >
      <span>{pending ? t('artifact.processing') : result?.message}</span>
      {result && !pending && (
        <button
          type="button"
          onClick={() => void interaction.dispatch({
            id: interaction.createOperationId(), kind: 'artifact.result.dismiss',
          })}
          className="min-h-11 flex-shrink-0 rounded-md px-3 text-gray-300 hover:bg-[#303030]"
        >
          {t('artifact.host.dismiss')}
        </button>
      )}
    </div>
  );
}
