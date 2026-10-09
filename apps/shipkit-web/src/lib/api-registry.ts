import type { ApiDefinition } from '@svton/api-client';
import type { Checks, HistoryView, LiveProject, Logs, Plan, PlanRequest, Project, ProjectPatch, ProjectRegistration, Task, TaskDetail, TaskEvent } from './contracts';
import type { AgentResourceChecks, AgentResourceList } from './agent-contracts';
import type { AuthSession, LoginInput } from '@/auth/contracts';
import type { RepositoryInput, RepositoryPatch, RepositoryPreview, RepositoryView } from './source-contracts';
import type { ConfigDraft, ConfigDraftInput, ConfigDraftPatch, ConfigPreview, ConfigVersion } from './config-contracts';

declare module '@svton/api-client' {
  interface GlobalApiRegistry {
    'POST:/auth/login': ApiDefinition<LoginInput, AuthSession>;
    'GET:/auth/session': ApiDefinition<Record<string, never>, AuthSession>;
    'POST:/auth/logout': ApiDefinition<Record<string, never>, { ok: true }>;
    'POST:/repositories/preview': ApiDefinition<{ repository: RepositoryInput; token?: string; username?: string }, RepositoryPreview>;
    'GET:/projects/:id/repository': ApiDefinition<{ id: string }, RepositoryView>;
    'PATCH:/projects/:id/repository': ApiDefinition<{ id: string } & RepositoryPatch, RepositoryView>;
    'POST:/projects/:id/repository/preview': ApiDefinition<{ id: string; repository: RepositoryInput; token?: string | null; username?: string | null }, RepositoryPreview>;
    'GET:/projects/:projectId/configs/:targetKey/drafts': ApiDefinition<{ projectId: string; targetKey: string }, { items: ConfigDraft[] }>;
    'POST:/projects/:projectId/configs/:targetKey/drafts': ApiDefinition<{ projectId: string; targetKey: string } & ConfigDraftInput, ConfigDraft>;
    'GET:/projects/:projectId/configs/:targetKey/drafts/:id': ApiDefinition<{ projectId: string; targetKey: string; id: string }, ConfigDraft>;
    'PATCH:/projects/:projectId/configs/:targetKey/drafts/:id': ApiDefinition<{ projectId: string; targetKey: string; id: string } & ConfigDraftPatch, ConfigDraft>;
    'GET:/projects/:projectId/configs/:targetKey/drafts/:id/preview': ApiDefinition<{ projectId: string; targetKey: string; id: string; etag?: string }, ConfigPreview>;
    'POST:/projects/:projectId/configs/:targetKey/drafts/:id/freeze': ApiDefinition<{ projectId: string; targetKey: string; id: string; etag: string; version: string }, ConfigVersion>;
    'GET:/projects/:projectId/configs/:targetKey/versions': ApiDefinition<{ projectId: string; targetKey: string }, { items: ConfigVersion[] }>;
    'GET:/projects/:projectId/configs/:targetKey/versions/:id': ApiDefinition<{ projectId: string; targetKey: string; id: string }, ConfigVersion>;
    'POST:/projects/:projectId/configs/:targetKey/versions/:id/archive': ApiDefinition<{ projectId: string; targetKey: string; id: string }, ConfigVersion>;
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
