import type { ToolContext } from '../types';

export function resolveToolPath(ctx: ToolContext, pathArg: string): string {
  if (isAbsoluteToolPath(pathArg)) {
    return ctx.platform.fs.resolve(pathArg);
  }
  return ctx.platform.fs.resolve(ctx.platform.fs.join(ctx.workingDir, pathArg));
}

function isAbsoluteToolPath(pathArg: string): boolean {
  return pathArg.startsWith('/')
    || /^[A-Za-z]:[\\/]/.test(pathArg)
    || pathArg.startsWith('\\\\');
}
