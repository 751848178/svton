import { splitShellWords } from './shell-command.utils';
import { staticShellWordValue } from './shell-static-variable-command.utils';

export function staticShellForLoopValues(valuesText: string): string[] | null {
  const values: string[] = [];

  for (const valueToken of splitShellWords(valuesText)) {
    const value = staticShellWordValue(valueToken);
    if (value === null) return null;
    values.push(value);
  }

  return values;
}
