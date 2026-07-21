import { staticAssignmentCommandStrings } from './shell-static-assignment-command.utils';
import type { StaticAssignmentCommandOptions } from './shell-static-assignment.types';

export function staticAssignmentCommandVariants(command: string, options?: StaticAssignmentCommandOptions): string[] {
  const variants = staticAssignmentCommandStrings(command, options);
  return variants.length > 0 ? [command, ...variants] : [command];
}

export function staticAssignmentCommandVariantResults<T>(
  command: string,
  callback: (variant: string) => T[],
  options?: StaticAssignmentCommandOptions,
): T[] {
  return staticAssignmentCommandStrings(command, options).flatMap(callback);
}

export function preferredStaticAssignmentCommandResults<T>(
  command: string,
  callback: (variant: string) => T[],
  options?: StaticAssignmentCommandOptions,
): T[] | null {
  const variants = staticAssignmentCommandStrings(command, options);
  return variants.length > 0 ? variants.flatMap(callback) : null;
}

export function hasStaticAssignmentCommandVariant(
  command: string,
  predicate: (variant: string) => boolean,
  options?: StaticAssignmentCommandOptions,
): boolean {
  return staticAssignmentCommandStrings(command, options).some(predicate);
}
