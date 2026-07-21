import {
  isFindDeleteTargetingHome,
  isFindDeleteTargetingRoot,
} from './find-delete-command.utils';
import {
  isRmRecursiveForceTargetingHome,
  isRmRecursiveForceTargetingRoot,
} from './rm-command.utils';
import { isRemoteFetchPipedToShell } from './remote-shell-pipe.utils';
import { aliasExpandedShellCommand } from './shell-alias-command.utils';
import { staticAssignmentCommandVariants } from './shell-static-assignment-variant.utils';
import type { ReviewRule } from './types';

/**
 * Built-in auto-reviewer rules.
 *
 * These rules protect against destructive operations:
 * - `rm -rf /` and `rm -rf ~` (wiping root or home)
 * - Writing to system directories
 * - Piping remote scripts into a shell (curl | bash)
 *
 * Safe read-only tools are auto-approved for convenience.
 *
 * Order matters: dangerous patterns should be checked first.
 * These are intentionally conservative — when in doubt, ask the user.
 */

/** Read-only tools that are always safe to auto-approve */
const READ_ONLY_TOOLS = ['file_read', 'glob', 'grep'];

/** System directories that must never be written to */
const SYSTEM_DIRS = ['/etc', '/usr', '/bin', '/System'];

/**
 * Extract the command string from a bash tool call.
 */
function getBashCommand(args: Record<string, unknown>): string {
  const cmd = args.command ?? args.cmd ?? '';
  return typeof cmd === 'string' ? cmd : '';
}

function bashCommandVariants(command: string): string[] {
  const aliasExpanded = aliasExpandedShellCommand(command);
  const commands = aliasExpanded ? [command, aliasExpanded] : [command];
  return commands.flatMap((commandVariant) => staticAssignmentCommandVariants(commandVariant));
}

/**
 * Extract the file path from a file_write tool call.
 */
function getFilePath(args: Record<string, unknown>): string {
  const path = args.path ?? args.filePath ?? '';
  return typeof path === 'string' ? path : '';
}

export const BUILTIN_RULES: ReviewRule[] = [
  // ----------------------------------------------------------
  // Dangerous bash commands — DENY
  // ----------------------------------------------------------
  {
    id: 'bash-rm-rf-root',
    description: 'Deny rm -rf targeting the filesystem root',
    verdict: 'deny',
    reason: 'Refusing to delete filesystem root (rm -rf /)',
    matches: (ctx) => {
      if (ctx.toolName !== 'bash' && ctx.toolName !== 'Bash') return false;
      const cmd = getBashCommand(ctx.args);
      return bashCommandVariants(cmd).some((command) => isRmRecursiveForceTargetingRoot(command, ctx.workingDir));
    },
  },
  {
    id: 'bash-rm-rf-home',
    description: 'Deny rm -rf targeting the home directory',
    verdict: 'deny',
    reason: 'Refusing to delete home directory (rm -rf ~ or $HOME)',
    matches: (ctx) => {
      if (ctx.toolName !== 'bash' && ctx.toolName !== 'Bash') return false;
      const cmd = getBashCommand(ctx.args);
      return bashCommandVariants(cmd).some(isRmRecursiveForceTargetingHome);
    },
  },
  {
    id: 'bash-find-delete-root',
    description: 'Deny find -delete targeting the filesystem root',
    verdict: 'deny',
    reason: 'Refusing to delete filesystem root (find / -delete)',
    matches: (ctx) => {
      if (ctx.toolName !== 'bash' && ctx.toolName !== 'Bash') return false;
      const cmd = getBashCommand(ctx.args);
      return bashCommandVariants(cmd).some((command) => isFindDeleteTargetingRoot(command, ctx.workingDir));
    },
  },
  {
    id: 'bash-find-delete-home',
    description: 'Deny find -delete targeting the home directory',
    verdict: 'deny',
    reason: 'Refusing to delete home directory (find ~ -delete)',
    matches: (ctx) => {
      if (ctx.toolName !== 'bash' && ctx.toolName !== 'Bash') return false;
      const cmd = getBashCommand(ctx.args);
      return bashCommandVariants(cmd).some((command) => isFindDeleteTargetingHome(command, ctx.workingDir));
    },
  },
  {
    id: 'bash-curl-pipe-bash',
    description: 'Deny piping remote content into a shell',
    verdict: 'deny',
    reason: 'Refusing to pipe remote script into shell (curl/wget | bash)',
    matches: (ctx) => {
      if (ctx.toolName !== 'bash' && ctx.toolName !== 'Bash') return false;
      const cmd = getBashCommand(ctx.args);
      return bashCommandVariants(cmd).some((command) => isRemoteFetchPipedToShell(command, ctx.workingDir));
    },
  },

  // ----------------------------------------------------------
  // Dangerous file writes — DENY
  // ----------------------------------------------------------
  {
    id: 'file-write-system-dir',
    description: 'Deny file writes to system directories',
    verdict: 'deny',
    reason: 'Refusing to write to system directory',
    matches: (ctx) => {
      const writeTools = ['file_write', 'file_edit', 'file_write', 'FileWrite', 'FileEdit'];
      if (!writeTools.includes(ctx.toolName)) return false;
      const filePath = getFilePath(ctx.args);
      return SYSTEM_DIRS.some(
        (dir) => filePath === dir || filePath.startsWith(dir + '/'),
      );
    },
  },

  // ----------------------------------------------------------
  // Safe read-only tools — AUTO APPROVE
  // ----------------------------------------------------------
  {
    id: 'read-only-safe',
    description: 'Auto-approve read-only tools (file_read, glob, grep)',
    verdict: 'approve',
    reason: 'Read-only tool, auto-approved',
    matches: (ctx) => READ_ONLY_TOOLS.includes(ctx.toolName),
  },
];
