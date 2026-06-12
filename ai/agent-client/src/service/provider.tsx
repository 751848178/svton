import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { container } from '@svton/service';
import type { IPlatform } from '@svton/agent-platform';
import type { AgentConfig } from '@svton/agent-core';
import { ChatService } from './chat.service';
import { SessionService } from './session.service';
import { ProjectService } from './project.service';

/** Minimal interface for the reactive internal instance */
export interface InternalLike<T> {
  subscribe(key: string | symbol, callback: () => void): () => void;
  getState<K extends keyof T>(key: K): T[K];
}

interface AgentContextValue {
  platform: IPlatform;
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

interface AgentProviderProps {
  platform: IPlatform;
  config: AgentConfig;
  children: React.ReactNode;
}

/**
 * Top-level provider that initializes Agent services.
 * Uses the @svton/service container to create reactive instances.
 */
export function AgentProvider({ platform, config, children }: AgentProviderProps) {
  const scopeRef = useRef(container.createScope());
  // Track what config we've already initialized with, to avoid re-init on every render
  const initConfigRef = useRef<AgentConfig | null>(null);
  const initStorageRef = useRef<IPlatform['storage'] | null>(null);

  // Create service instances in useMemo (pure, no side effects)
  const instances = useMemo(() => {
    const scope = scopeRef.current;
    const chatInternal = scope.ensureOwnInternal(ChatService);
    const sessionInternal = scope.ensureOwnInternal(SessionService);
    const projectInternal = scope.ensureOwnInternal(ProjectService);
    return { chatInternal, sessionInternal, projectInternal };
  }, []);

  // Initialize services in useEffect — ONLY when config actually changes
  useEffect(() => {
    // Skip re-initialization if we already initialized with this config
    if (initConfigRef.current === config && initStorageRef.current === platform.storage) {
      return;
    }
    initConfigRef.current = config;
    initStorageRef.current = platform.storage;
    instances.chatInternal.target.init(platform, config);
    instances.sessionInternal.target.init(platform.storage);
    instances.projectInternal.target.init(platform.storage);
  }, [platform, config, instances]);

  const value = useMemo(() => ({
    platform,
    chatService: instances.chatInternal.target,
    sessionService: instances.sessionInternal.target,
    projectService: instances.projectInternal.target,
    chatInternal: instances.chatInternal,
    sessionInternal: instances.sessionInternal,
    projectInternal: instances.projectInternal,
    flush: globalFlush,
  }), [instances]);

  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
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
