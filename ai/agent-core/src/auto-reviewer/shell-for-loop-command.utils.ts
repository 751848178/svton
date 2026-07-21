import { splitShellWords } from './shell-command.utils';
import { staticForLoopCommands } from './shell-for-loop-parser.utils';
import { staticShellWordValue, substituteStaticShellVariables } from './shell-static-variable-command.utils';

const STATIC_SELECT_LOOP_PATTERN = /\bselect\s+([A-Za-z_]\w*)\s+in\s+([\s\S]*?)(?:;|\n)\s*do\s+([\s\S]*?)(?:;|\n)\s*done\s*<<<\s*(\S+)/g;

export function staticShellLoopCommandStrings(command: string): string[] {
  return [
    ...staticForLoopCommandStrings(command),
    ...staticSelectLoopCommandStrings(command),
  ];
}

export function staticForLoopCommandStrings(command: string): string[] {
  const commands: string[] = [];

  for (const { variableName, valuesText, body } of staticForLoopCommands(command)) {
    for (const valueToken of splitShellWords(valuesText)) {
      const value = staticShellWordValue(valueToken);
      if (value === null) continue;
      commands.push(substituteStaticShellVariables(body, new Map([[variableName, value]])));
    }
  }

  return commands;
}

function staticSelectLoopCommandStrings(command: string): string[] {
  const commands: string[] = [];

  for (const match of command.matchAll(STATIC_SELECT_LOOP_PATTERN)) {
    const [, variableName, valuesText, body, choiceToken] = match;
    const choice = staticShellWordValue(choiceToken);
    const choiceIndex = choice === null ? Number.NaN : Number(choice);
    if (!Number.isInteger(choiceIndex) || choiceIndex < 1) continue;

    const value = splitShellWords(valuesText)
      .map(staticShellWordValue)[choiceIndex - 1];
    if (value === null || value === undefined) continue;
    commands.push(substituteStaticShellVariables(body, new Map([[variableName, value]])));
  }

  return commands;
}
