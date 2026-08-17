import type { SessionActivityViewModel } from './session-activity.types';
import type { SessionInfo } from './session.types';
import type { SessionManagementCommand, SessionManagementViewModel } from './session-management.types';

const LIVE_PHASES = new Set([
  'inProgress', 'waitingOnApproval', 'waitingOnUserInput', 'finalizing',
]);

export function projectSessionManagement(
  session: SessionInfo,
  activity?: SessionActivityViewModel,
): SessionManagementViewModel {
  const isArchived = session.archivedAt !== undefined;
  const isRunning = !!activity && LIVE_PHASES.has(activity.phase);
  const commands: SessionManagementCommand[] = ['rename'];
  if (!isArchived) commands.push(session.isPinned ? 'unpin' : 'pin');
  if (isArchived) commands.push('unarchive');
  else commands.push(isRunning ? 'stopAndArchive' : 'archive');
  commands.push('delete');
  return { sessionId: session.id, isPinned: session.isPinned, isArchived, isRunning, commands };
}
