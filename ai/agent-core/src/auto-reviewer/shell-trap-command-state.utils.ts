import {
  type ShellTrapActionCommand,
  type ShellTrapCommandUpdate,
} from './shell-trap-action-command.utils';

export function applyShellTrapCommandUpdate(
  commands: ShellTrapActionCommand[],
  update: ShellTrapCommandUpdate,
): ShellTrapActionCommand[] {
  const retained = removeUpdatedSignals(commands, update.signals);
  return update.command ? [...retained, update.command] : retained;
}

export function shellTrapCommandHasSignal(
  command: ShellTrapActionCommand,
  signal: string,
): boolean {
  const target = normalizeTrapSignal(signal);
  return command.signals.some((item) => normalizeTrapSignal(item) === target);
}

export function shellTrapCommandIsExit(command: ShellTrapActionCommand): boolean {
  return command.signals.some((signal) => {
    const normalized = normalizeTrapSignal(signal);
    return normalized === 'EXIT' || normalized === '0';
  });
}

export function shellTrapCommandOnlyExit(command: ShellTrapActionCommand): boolean {
  return command.signals.length > 0 && command.signals.every((signal) => {
    const normalized = normalizeTrapSignal(signal);
    return normalized === 'EXIT' || normalized === '0';
  });
}

function removeUpdatedSignals(
  commands: ShellTrapActionCommand[],
  signals: string[],
): ShellTrapActionCommand[] {
  const updated = new Set(signals.map(normalizeTrapSignal));
  return commands.flatMap((command) => {
    const retainedSignals = command.signals.filter(
      (signal) => !updated.has(normalizeTrapSignal(signal)),
    );
    return retainedSignals.length > 0 ? [{ ...command, signals: retainedSignals }] : [];
  });
}

function normalizeTrapSignal(signal: string): string {
  const upper = signal.toUpperCase();
  if (upper === '0') return upper;
  return upper.startsWith('SIG') ? upper.slice(3) : upper;
}
