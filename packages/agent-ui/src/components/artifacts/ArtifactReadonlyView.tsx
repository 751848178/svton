import { DiffView } from '../chat/DiffView';
import { useI18n } from '@svton/ui';
import type {
  ArtifactInteraction,
  ReadonlyArtifactTarget,
} from './artifact.types';

export function ArtifactReadonlyView({ target, interaction }: {
  target: ReadonlyArtifactTarget;
  interaction: ArtifactInteraction;
}) {
  const { translate: t } = useI18n();
  if (target.kind === 'diff') {
    return (
      <div className="h-full overflow-auto p-4" aria-label={target.title}>
        {target.focusPath && <p className="mb-3 text-xs text-cyan-400">{t('artifact.readonly.focus', { path: target.focusPath })}</p>}
        <div className="space-y-4">
          {target.changes.map((change, index) => {
            const fileTarget = {
              kind: 'file' as const,
              id: `${target.id}:file:${index}`,
              path: change.path,
              source: 'change' as const,
            };
            return (
              <section key={`${change.path}:${index}`} aria-labelledby={`${target.id}-change-${index}`}>
                <div className="mb-2 flex min-h-11 items-center gap-2">
                  <h3 id={`${target.id}-change-${index}`} className="min-w-0 flex-1 truncate font-mono text-xs text-gray-200">{change.path}</h3>
                  <span className="rounded bg-[#333] px-2 py-1 text-[10px] text-gray-400">{t(`block.file_change.${change.changeType}`)}</span>
                  <HostOpenButton target={fileTarget} interaction={interaction} />
                </div>
                {change.diff ? <DiffView diff={change.diff} /> : <p className="text-xs text-gray-500">{t('artifact.readonly.noDiff')}</p>}
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  const location = target.line == null
    ? target.path
    : `${target.path}:${target.line}${target.column == null ? '' : `:${target.column}`}`;
  return (
    <div className="h-full overflow-auto p-5">
      <p className="text-xs text-gray-500">{t('artifact.readonly.label')}</p>
      <p className="mt-2 break-all font-mono text-sm leading-6 text-gray-200">{location}</p>
      {target.kind === 'reference' && target.snippet && (
        <pre className="mt-4 overflow-auto rounded-lg border border-[#383838] bg-[#1c1c1c] p-3 text-xs text-gray-300">{target.snippet}</pre>
      )}
      <div className="mt-5"><HostOpenButton target={target} interaction={interaction} /></div>
    </div>
  );
}

function HostOpenButton({ target, interaction }: {
  target: Extract<ReadonlyArtifactTarget, { kind: 'file' | 'reference' }>;
  interaction: ArtifactInteraction;
}) {
  const { translate: t } = useI18n();
  const capability = interaction.resolveOpenCapability(target);
  return (
    <div>
      <button
        type="button"
        disabled={!capability.supported || interaction.state.pending}
        onClick={() => void interaction.dispatch({
          id: interaction.createOperationId(), kind: 'artifact.host.open', target,
        })}
        className="min-h-11 rounded-lg border border-[#454545] px-3 text-xs text-gray-200 hover:bg-[#303030] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t('artifact.openInHost')}
      </button>
      {!capability.supported && <p className="mt-2 text-xs text-amber-300">{capability.reason}</p>}
    </div>
  );
}
