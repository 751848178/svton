import { posix as pathPosix } from 'node:path';
import { commandSubstitutionOutputToken } from './command-substitution-token.utils';
import { braceExpandedShellTokens } from './shell-brace-expansion.utils';
import { hasUnquotedShellGlob } from './shell-glob-token.utils';
import { shellParameterOperatorWordToken } from './shell-parameter-word.utils';
import { normalizeShellWordToken } from './shell-command.utils';

type RootTargetCandidate = {
  path: string;
  token: string;
  extglobEnabled: boolean;
  globEnabled: boolean;
};

const EXTGLOB_ENABLED_TARGET_PREFIX = '\0extglob:';
const GLOB_DISABLED_TARGET_PREFIX = '\0noglob:';

export function markExtglobEnabledTargets(tokens: string[], enabled: boolean): string[] {
  return enabled ? tokens.map((token) => `${EXTGLOB_ENABLED_TARGET_PREFIX}${token}`) : tokens;
}

export function markShellGlobStateTargets(tokens: string[], extglobEnabled: boolean, globEnabled: boolean): string[] {
  return markExtglobEnabledTargets(
    globEnabled ? tokens : tokens.map((token) => `${GLOB_DISABLED_TARGET_PREFIX}${token}`),
    extglobEnabled,
  );
}

function normalizeExpandableHomeTarget(token: string): string {
  const expandedToken = normalizeShellWordToken(commandSubstitutionTargetToken(token));
  const defaultTarget = shellParameterOperatorWordToken(expandedToken);
  if (defaultTarget) return normalizeExpandableHomeTarget(defaultTarget);

  const homeExpansion = homePreservingParameterExpansionToken(expandedToken);
  if (homeExpansion) return homeExpansion;

  if (
    expandedToken.startsWith('$HOME')
    || expandedToken.startsWith('${HOME}')
  ) {
    return expandedToken;
  }
  return expandedToken;
}

function homePreservingParameterExpansionToken(token: string): string {
  const match = token.match(/^\$\{HOME(?::?\?[^}]*)?\}(.*)$/)
    ?? token.match(/^\$\{HOME%%?[^}]*\}(.*)$/)
    ?? token.match(/^\$\{HOME:0\}(.*)$/)
    ?? token.match(/^\$\{HOME#{1,2}\}(.*)$/);
  return match ? `$HOME${match[1]}` : '';
}

function isRootAliasPath(path: string): boolean {
  if (/^\/+$/.test(path)) return true;
  if (!path.startsWith('/')) return false;

  const segments = path.split('/').filter(Boolean);
  return segments.length > 0 && segments.every(isRootAliasSegment);
}

function normalizeAbsoluteRootPath(path: string): string {
  if (!path.startsWith('/')) return path;

  const segments: string[] = [];
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return `/${segments.join('/')}`;
}

function normalizeRootTargets(token: string, workingDir = ''): RootTargetCandidate[] {
  const unmarked = unmarkExtglobEnabledTarget(token);
  const expandedToken = commandSubstitutionTargetToken(unmarked.token);
  const defaultTarget = shellParameterOperatorWordToken(expandedToken);
  const target = defaultTarget ? commandSubstitutionTargetToken(defaultTarget) : expandedToken;
  return braceExpandedShellTokens(target).map((candidate) => {
    const path = normalizeCwdRelativeRootPath(normalizeShellWordToken(candidate), workingDir);
    return {
      path: isRootAliasPath(path) ? '/' : path,
      token: candidate,
      extglobEnabled: unmarked.extglobEnabled,
      globEnabled: unmarked.globEnabled,
    };
  });
}

function unmarkExtglobEnabledTarget(token: string): { token: string; extglobEnabled: boolean; globEnabled: boolean } {
  let unmarked = token;
  let extglobEnabled = false;
  let globEnabled = true;

  if (unmarked.startsWith(EXTGLOB_ENABLED_TARGET_PREFIX)) {
    extglobEnabled = true;
    unmarked = unmarked.slice(EXTGLOB_ENABLED_TARGET_PREFIX.length);
  }
  if (unmarked.startsWith(GLOB_DISABLED_TARGET_PREFIX)) {
    globEnabled = false;
    unmarked = unmarked.slice(GLOB_DISABLED_TARGET_PREFIX.length);
  }
  return { token: unmarked, extglobEnabled, globEnabled };
}

function commandSubstitutionTargetToken(token: string): string {
  return commandSubstitutionOutputToken(token) || token;
}

function normalizeCwdRelativeRootPath(path: string, workingDir: string): string {
  if (path.startsWith('/') || !workingDir.startsWith('/')) return normalizeAbsoluteRootPath(path);

  return normalizeAbsoluteRootPath(pathPosix.join(workingDir, path));
}

function isRootContentsTarget(path: string): boolean {
  if (path.startsWith('/*')) return true;

  const segments = path.slice(1).split('/').filter(Boolean);
  const contentIndex = segments.findIndex((segment) => !isRootAliasSegment(segment));
  const contentSegment = contentIndex >= 0 ? segments[contentIndex] : '';
  return isRootContentsSegment(contentSegment);
}

function isRootAliasSegment(segment: string): boolean {
  if (segment === '') return true;
  if (segment === '.' || segment === '..') return true;
  return false;
}

function isRootContentsSegment(segment: string): boolean {
  return segment.startsWith('*')
    || segment.startsWith('?')
    || segment.startsWith('[')
    || /^[@+!]\(.+\)$/.test(segment)
    || (segment.startsWith('.') && /[*?\[]/.test(segment));
}

export function tokenTargetsRoot(token: string, workingDir = ''): boolean {
  return normalizeRootTargets(token, workingDir)
    .some((candidate) => (
      candidate.path === '/'
      || (
        isRootContentsTarget(candidate.path)
        && candidate.globEnabled
        && hasUnquotedShellGlob(candidate.token, candidate.extglobEnabled)
      )
    ));
}

export function tokenTargetsHome(token: string): boolean {
  const path = normalizeExpandableHomeTarget(unmarkExtglobEnabledTarget(token).token);
  return (hasUnquotedHomeTildePrefix(token) && (
    path === '~'
    || path.startsWith('~/')
  ))
    || path === '$HOME'
    || path.startsWith('$HOME/')
    || path === '${HOME}'
    || path.startsWith('${HOME}/');
}

function hasUnquotedHomeTildePrefix(token: string): boolean {
  return token.startsWith('~');
}
