import type { ApiDefinition } from '@svton/api-client';
import type { Checks, HistoryView, LiveProject, Logs, Plan, PlanRequest, Project, ProjectPatch, ProjectRegistration, Task, TaskDetail, TaskEvent } from './contracts';
import type { AgentResourceChecks, AgentResourceList } from './agent-contracts';
import type { AuthSession, LoginInput } from '@/auth/contracts';

declare module '@svton/api-client' {
  interface GlobalApiRegistry {
    'POST:/auth/login': ApiDefinition<LoginInput, AuthSession>;
    'GET:/auth/session': ApiDefinition<Record<string, never>, AuthSession>;
    'POST:/auth/logout': ApiDefinition<Record<string, never>, { ok: true }>;
    'GET:/agents': ApiDefinition<Record<string, never>, AgentResourceList>;
    'POST:/agents/:id/checks': ApiDefinition<{ id: string }, AgentResourceChecks>;
    'GET:/projects': ApiDefinition<Record<string, never>, { items: Project[] }>;
    'POST:/projects': ApiDefinition<ProjectRegistration, Project>;
    'GET:/projects/:id': ApiDefinition<{ id: string }, Project>;
    'PATCH:/projects/:id': ApiDefinition<ProjectPatch & { id: string }, Project>;
    'GET:/projects/:id/status': ApiDefinition<{ id: string }, { project: Project; live: LiveProject }>;
    'POST:/projects/:id/plans': ApiDefinition<PlanRequest & { id: string }, Plan>;
    'POST:/projects/:id/tasks': ApiDefinition<{ id: string; planId: string; idempotencyKey?: string }, Task>;
    'GET:/projects/:id/tasks': ApiDefinition<{ id: string }, { items: Task[] }>;
    'GET:/tasks/:id': ApiDefinition<{ id: string }, TaskDetail>;
    'GET:/tasks/:id/events': ApiDefinition<{ id: string; after: number }, { events: TaskEvent[]; nextSeq: number; complete: boolean }>;
    'GET:/tasks/:id/logs': ApiDefinition<{ id: string; stage?: string; service?: string; offset?: number }, Logs>;
    'POST:/tasks/:id/cancel': ApiDefinition<{ id: string }, Task>;
    'POST:/tasks/:id/cleanup': ApiDefinition<{ id: string }, Task>;
    'GET:/projects/:id/history': ApiDefinition<{ id: string }, HistoryView>;
    'POST:/projects/:id/checks': ApiDefinition<{ id: string }, Checks>;
  }
}
export {};
