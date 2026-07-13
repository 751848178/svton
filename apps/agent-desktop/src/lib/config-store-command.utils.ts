export function buildEnsureDirCommand(dir: string, platformName: string): string {
  return isWindowsPlatform(platformName)
    ? `mkdir ${quoteWindowsCmdArg(dir)}`
    : `mkdir -p ${quotePosixShellArg(dir)}`;
}

export function buildOpenPathCommand(path: string, platformName: string): string {
  return isWindowsPlatform(platformName)
    ? `start "" ${quoteWindowsCmdArg(path)}`
    : `open ${quotePosixShellArg(path)}`;
}

export function readNavigatorPlatform(): string {
  return typeof navigator === 'undefined' ? '' : navigator.platform;
}

function isWindowsPlatform(platformName: string): boolean {
  return platformName.toLowerCase().includes('win');
}

function quotePosixShellArg(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function quoteWindowsCmdArg(value: string): string {
  return `"${value.replace(/(["^&|<>%])/g, '^$1')}"`;
}
