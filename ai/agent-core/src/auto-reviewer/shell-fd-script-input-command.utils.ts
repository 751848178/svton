import { hereDocCommandStringsForFd } from './shell-here-doc-command.utils';
import { scriptInputWordCommandString } from './shell-script-input-word.utils';

function fdHereStringScriptCommandStrings(tokens: string[], fd: number): string[] {
  const scripts: string[] = [];
  const redirectToken = `${fd}<<<`;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === redirectToken) {
      const script = scriptInputWordCommandString(tokens[index + 1] ?? '');
      if (script) scripts.push(script);
      index += 1;
      continue;
    }

    if (token.startsWith(redirectToken)) {
      const script = scriptInputWordCommandString(token.slice(redirectToken.length));
      if (script) scripts.push(script);
    }
  }

  return scripts;
}

export function fdScriptInputCommandStrings(
  segment: string,
  tokens: string[],
  fd: number,
): string[] {
  return fdHereStringScriptCommandStrings(tokens, fd)
    .concat(hereDocCommandStringsForFd(segment, fd));
}
