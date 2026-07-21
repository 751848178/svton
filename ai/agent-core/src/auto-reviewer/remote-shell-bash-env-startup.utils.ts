import { bashEnvStartupCommandStrings } from './shell-bash-env-command-string.utils';
import { normalizeBashEnvStaticCommandOutput } from './shell-bash-env-command-output.utils';
import { stripHereDocBodies } from './shell-script-input-command.utils';

type TokensStartWithShell = (tokens: string[]) => boolean;
type TokenResolvesToShell = (token: string) => boolean;
type RemoteFetchDetector = (command: string, depth: number) => boolean;

export function bashEnvStartupReceivesRemoteFetch(
  command: string,
  depth: number,
  tokensStartWithShell: TokensStartWithShell,
  tokenResolvesToShell: TokenResolvesToShell,
  receivesRemoteFetch: RemoteFetchDetector,
  workingDir = '',
): boolean {
  const bashEnvCommand = normalizeBashEnvStaticCommandOutput(command);
  const bashEnvCommandHeader = stripHereDocBodies(bashEnvCommand);
  return bashEnvStartupCommandStrings(
    bashEnvCommandHeader,
    tokensStartWithShell,
    tokenResolvesToShell,
    { sourceCommand: bashEnvCommand, workingDir },
  ).some((script) => receivesRemoteFetch(script, depth + 1));
}
