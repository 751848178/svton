export function environmentVersionSwitchReasonKey(input: {
  active: boolean;
  blocked: boolean;
  readiness: string;
}): string {
  if (input.active) return 'envVersionSwitchDisabledActive';
  if (input.blocked) return 'envVersionSwitchDisabledApproval';
  if (input.readiness !== 'ready') return 'envVersionSwitchDisabledReadiness';
  return 'envVersionSwitchDisabledExecuting';
}
