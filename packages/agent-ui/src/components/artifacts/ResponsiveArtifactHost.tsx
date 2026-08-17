import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { cn } from '@svton/ui';
import { useInert } from '../use-inert';
import { ArtifactHostStatus } from './ArtifactHostStatus';
import { ArtifactPanel } from './ArtifactPanel';
import type { ArtifactInteraction } from './artifact.types';
import {
  MIN_ARTIFACT_PANE_WIDTH,
  MIN_CHAT_PANE_WIDTH,
  useMeasuredArtifactLayout,
} from './use-measured-artifact-layout';

export interface ResponsiveArtifactHostProps {
  interaction: ArtifactInteraction;
  chat: ReactNode;
  className?: string;
}

/** Pure measured layout around the existing artifact controller and panel. */
export function ResponsiveArtifactHost({
  interaction,
  chat,
  className,
}: ResponsiveArtifactHostProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const artifactRef = useRef<HTMLDivElement>(null);
  const layout = useMeasuredArtifactLayout(hostRef);
  const active = interaction.state.active;
  const split = Boolean(active && layout.canSplit);
  const previousSplit = useRef(split);
  const chatHidden = Boolean(active && !split);
  const artifactHidden = !active;
  useInert(chatRef, chatHidden);
  useInert(artifactRef, artifactHidden);
  useLayoutEffect(() => {
    const collapsed = previousSplit.current && !split && active;
    previousSplit.current = split;
    if (!collapsed || !chatRef.current?.contains(document.activeElement)) return;
    artifactRef.current?.querySelector<HTMLElement>('[data-artifact-heading]')?.focus();
  }, [active, split]);

  const layoutName = !active ? 'chat' : split ? 'split' : 'artifact';
  return (
    <div
      ref={hostRef}
      data-testid="artifact-test-host"
      data-responsive-artifact-host
      data-artifact-layout={layoutName}
      data-artifact-band={layout.band}
      data-measured-width={layout.width}
      className={cn(
        'relative min-h-0 min-w-0 flex-1',
        split ? 'grid' : 'flex',
        className,
      )}
      style={split ? {
        gridTemplateColumns: `minmax(${MIN_CHAT_PANE_WIDTH}px, 1fr) minmax(${MIN_ARTIFACT_PANE_WIDTH}px, 1fr)`,
      } : undefined}
    >
      <ArtifactHostStatus interaction={interaction} />
      <div
        ref={chatRef}
        data-artifact-chat-pane
        aria-hidden={chatHidden ? true : undefined}
        className={cn(
          'min-h-0 min-w-0 flex-col',
          chatHidden ? 'invisible pointer-events-none absolute inset-0 flex' : 'flex',
          !split && !active && 'flex-1',
        )}
      >
        {chat}
      </div>
      <div
        ref={artifactRef}
        data-artifact-content-pane
        aria-hidden={artifactHidden ? true : undefined}
        className={cn(
          'min-h-0 min-w-0 flex-col',
          artifactHidden ? 'hidden' : 'flex',
          active && !split && 'flex-1',
        )}
      >
        {active && (
          <div className="min-h-0 flex-1">
            <ArtifactPanel
              interaction={interaction}
              closePresentation={split ? 'close' : 'back'}
              className={!split ? '!border-l-0' : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}
