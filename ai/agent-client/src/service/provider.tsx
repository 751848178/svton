import React, { createContext, useContext, useMemo, useRef } from 'react';
import { container } from '@svton/service';
import type { IPlatform } from '@svton/agent-platform';
import type { AgentConfig } from '@svton/agent-core';
import { ChatService } from './chat.service';
import { SessionService } from './session.service';
import { ProjectService } from './project.service';
import { useAgentProviderStartup } from '../startup/use-agent-provider-startup';
import type { StartupTaskController } from '../startup/use-startup-task';
import type { ModelKey } from '../model-switch/model-switch.types';

/** Minimal interface for the reactive internal instance */
export interface InternalLike<T> {
  subscribe(key: string | symbol, callback: () => void): () => void;
  getState<K extends keyof T>(key: K): T[K];
}

interface AgentContextValue {
  platform: IPlatform;
  initialSessionId?: string;
  chatService: ChatService;
  sessionService: SessionService;
  projectService: ProjectService;
  chatInternal: InternalLike<ChatService>;
  sessionInternal: InternalLike<SessionService>;
  projectInternal: InternalLike<ProjectService>;
  /**
   * Force-save all pending messages to storage.
   * Used by the desktop app before window close.
   */
  flush: () => Promise<void>;
}

const AgentContext = createContext<AgentContextValue | null>(null);

/**
 * Global flush ref — set by useSession, readable from anywhere.
 * Allows App.tsx (outside AgentProvider) to trigger flush before window close.
 */
let _flushFn: (() => Promise<void>) | null = null;

export function setFlushFn(fn: () => Promise<void>) {
  _flushFn = fn;
}

export async function globalFlush() {
  if (_flushFn) await _flushFn();
}

export interface AgentProviderProps {
  platform: IPlatform;
  config: AgentConfig;
  runtimeKey?: string;
  modelKey?: ModelKey;
  initialSessionId?: string;
  children: React.ReactNode;
  startupFallback?: (controller: StartupTaskController<void>) => React.ReactNode;
  beforeStartupSource?: (source: 'chat' | 'session' | 'project') => void | Promise<void>;
}

/**
 * Top-level provider that initializes Agent services.
 * Uses the @svton/service container to create reactive instances.
 */
export function AgentProvider({
  platform,
  config,
  runtimeKey,
  modelKey,
  initialSessionId,
  children,
  startupFallback,
  beforeStartupSource,
}: AgentProviderProps) {
  const scopeRef = useRef(container.createScope());

  // Create service instances in useMemo (pure, no side effects)
  const instances = useMemo(() => {
    const scope = scopeRef.current;
    const chatInternal = scope.ensureOwnInternal(ChatService);
    const sessionInternal = scope.ensureOwnInternal(SessionService);
    const projectInternal = scope.ensureOwnInternal(ProjectService);
    return { chatInternal, sessionInternal, projectInternal };
  }, []);

  const startup = useAgentProviderStartup({
    platform,
    config,
    runtimeKey,
    modelKey,
    chatService: instances.chatInternal.target,
    sessionService: instances.sessionInternal.target,
    projectService: instances.projectInternal.target,
    beforeSource: beforeStartupSource,
  });

  const value = useMemo(() => ({
    platform,
    initialSessionId,
    chatService: instances.chatInternal.target,
    sessionService: instances.sessionInternal.target,
    projectService: instances.projectInternal.target,
    chatInternal: instances.chatInternal,
    sessionInternal: instances.sessionInternal,
    projectInternal: instances.projectInternal,
    flush: globalFlush,
  }), [instances, platform, initialSessionId]);

  if (startup.state.phase !== 'ready') {
    return startupFallback?.(startup) ?? <DefaultStartupFallback controller={startup} />;
  }

  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  );
}

function DefaultStartupFallback({ controller }: { controller: StartupTaskController<void> }) {
  const { state } = controller;
  if (state.phase === 'loading') return <div role="status">Initializing agent…</div>;
  return (
    <div role="alert">
      <p>{state.phase === 'error' ? state.cause : 'Agent configuration is required.'}</p>
      <button type="button" onClick={controller.retry}>Retry</button>
    </div>
  );
}

/**
 * Hook to access agent context.
 * Must be used within an AgentProvider.
 */
export function useAgentContext(): AgentContextValue {
  const ctx = useContext(AgentContext);
  if (!ctx) {
    throw new Error('useAgentContext must be used within an AgentProvider');
  }
  return ctx;
}
