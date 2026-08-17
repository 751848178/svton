import type { TranslationKey } from '@svton/ui';
import type { SessionManagementCommand } from './sidebar.types';

export const sessionManagementCommandKeys: Record<SessionManagementCommand, TranslationKey> = {
  rename: 'session.manage.command.rename',
  pin: 'session.manage.command.pin',
  unpin: 'session.manage.command.unpin',
  archive: 'session.manage.command.archive',
  stopAndArchive: 'session.manage.command.stopAndArchive',
  unarchive: 'session.manage.command.unarchive',
  delete: 'session.manage.command.delete',
};
