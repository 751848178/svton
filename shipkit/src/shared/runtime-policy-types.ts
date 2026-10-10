/** Opt-in container restrictions; this contract deliberately has no privilege grants. */
export interface RuntimePolicy {
  readOnlyRoot?: true;
  dropCapabilities?: ['ALL'];
  noNewPrivileges?: true;
  stopGracePeriodSeconds?: number;
  tmpfs?: RuntimeTmpfs[];
}

export interface RuntimeTmpfs {
  target: string;
  sizeMiB: number;
  uid: number;
  gid: number;
  /** Octal directory permissions, optionally including the sticky bit. */
  mode: string;
}
