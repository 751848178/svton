/** Opt-in container restrictions; this contract deliberately has no privilege grants. */
export interface RuntimePolicy {
  /** Restricted policies do not automatically start containers after daemon restart. */
  restartPolicy?: 'no' | 'on-failure:3';
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
