import { serverRequest } from '@/lib/api-client/server';
import { redirectOnUnauthorized } from '@/lib/api-client/server-auth-redirect';
import { ProjectsContent } from './components/ProjectsContent';
import type { ProjectDirectoryResponse } from './types';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  let initialDirectory: ProjectDirectoryResponse | undefined;
  let loadFailed = false;

  try {
    initialDirectory = await serverRequest<ProjectDirectoryResponse>(
      'GET:/project-directory?take=100',
    );
  } catch (error) {
    redirectOnUnauthorized(error, '/projects');
    console.error('Failed to load project directory:', error);
    loadFailed = true;
  }

  return (
    <ProjectsContent
      initialDirectory={initialDirectory}
      loadFailed={loadFailed}
    />
  );
}
