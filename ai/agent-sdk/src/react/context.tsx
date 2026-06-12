/**
 * AgentProvider — React context that creates and provides an Agent instance.
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { CreateAgentConfig } from '../types';
import type { Agent } from '../agent';
import { createAgent } from '../create-agent';

// ============================================================
// Context
// ============================================================

interface AgentContextValue {
  agent: Agent;
}

const AgentContext = createContext<AgentContextValue | null>(null);

// ============================================================
// Provider Props
// ============================================================

export interface AgentProviderProps {
  /** Agent configuration — passed to createAgent() */
  config: CreateAgentConfig;
  /** Optional content shown while the agent is initializing */
  fallback?: ReactNode;
  children: ReactNode;
}

// ============================================================
// AgentProvider
// ============================================================

export function AgentProvider({ config, fallback, children }: AgentProviderProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    createAgent(config)
      .then((a) => {
        if (!cancelled && mountedRef.current) {
          setAgent(a);
          setError(null);
        } else {
          // Component unmounted before init completed — clean up
          a.dispose().catch(() => {});
        }
      })
      .catch((err) => {
        if (!cancelled && mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      });

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [config]);

  // Cleanup agent on unmount or config change
  const prevAgentRef = useRef<Agent | null>(null);
  useEffect(() => {
    if (prevAgentRef.current && prevAgentRef.current !== agent) {
      prevAgentRef.current.dispose().catch(() => {});
    }
    prevAgentRef.current = agent;
  }, [agent]);

  useEffect(() => {
    return () => {
      if (prevAgentRef.current) {
        prevAgentRef.current.dispose().catch(() => {});
      }
    };
  }, []);

  if (error) {
    throw error; // Let error boundary handle it
  }

  if (!agent) {
    return <>{fallback ?? null}</>;
  }

  return (
    <AgentContext.Provider value={{ agent }}>
      {children}
    </AgentContext.Provider>
  );
}

// ============================================================
// Hook to consume context
// ============================================================

export function useAgentContext(): AgentContextValue {
  const ctx = useContext(AgentContext);
  if (!ctx) {
    throw new Error('[agent-sdk/react] useAgentContext must be used within an <AgentProvider>');
  }
  return ctx;
}
