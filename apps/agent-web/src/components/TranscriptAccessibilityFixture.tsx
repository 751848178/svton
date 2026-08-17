'use client';

import { useEffect, useState } from 'react';
import { ChatPanel } from '@svton/agent-ui';
import desktopAppIcon from '../../../agent-desktop/src-tauri/icons/128x128@2x.png';
import {
  TRANSCRIPT_FIXTURE_EVENT,
  applyTranscriptFixtureState,
  initialTranscriptFixture,
  isTranscriptFixtureStateId,
} from './transcript-accessibility-fixture.data';

/** E2E-only host fixture that composes the production ChatPanel unchanged. */
export function TranscriptAccessibilityFixture() {
  const [enabled, setEnabled] = useState(false);
  const [fixture, setFixture] = useState(() => initialTranscriptFixture(desktopAppIcon.src));

  useEffect(() => {
    setEnabled(Boolean(window.localStorage.getItem('agent-web:e2e')));
    const onState = (event: Event) => {
      const stateId = (event as CustomEvent<unknown>).detail;
      if (!isTranscriptFixtureStateId(stateId)) return;
      if (stateId === 'theme-light') {
        document.documentElement.dataset.theme = 'light';
        document.documentElement.classList.add('light');
      } else if (stateId === 'theme-dark') {
        delete document.documentElement.dataset.theme;
        document.documentElement.classList.remove('light');
      }
      setFixture((current) => applyTranscriptFixtureState(current, stateId, desktopAppIcon.src));
    };
    window.addEventListener(TRANSCRIPT_FIXTURE_EVENT, onState);
    return () => window.removeEventListener(TRANSCRIPT_FIXTURE_EVENT, onState);
  }, []);

  if (!enabled) return <main>Fixture unavailable.</main>;

  return (
    <main
      className="h-screen overflow-hidden bg-background text-foreground"
      data-testid="transcript-accessibility-fixture"
      data-state-id={fixture.stateId}
    >
      <span hidden aria-hidden="true" data-testid="transcript-fixture-state">{fixture.stateId}</span>
      <ChatPanel
        messages={fixture.messages}
        isStreaming={fixture.streaming}
        onSend={() => undefined}
        onRetry={() => undefined}
        onEditMessage={() => undefined}
        onOpenEditor={() => undefined}
        timelineCapabilities={{ openTerminal: false, openPath: false }}
        onTimelineIntent={() => ({ status: 'handled' })}
      />
    </main>
  );
}
