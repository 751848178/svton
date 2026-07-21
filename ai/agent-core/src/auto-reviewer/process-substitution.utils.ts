export function isEscaped(segment: string, index: number): boolean {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && segment[cursor] === '\\'; cursor -= 1) {
    slashCount += 1;
  }

  return slashCount % 2 === 1;
}

export function readSubstitutionCommand(segment: string, commandStart: number): string {
  let command = '';
  let quote: '"' | "'" | null = null;
  let depth = 1;

  for (let index = commandStart; index < segment.length; index += 1) {
    const char = segment[index];
    if (char === '\\') {
      command += char;
      if (segment[index + 1]) {
        index += 1;
        command += segment[index];
      }
      continue;
    }

    if (quote) {
      command += char;
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      command += char;
      continue;
    }

    if (char === '(') {
      depth += 1;
      command += char;
      continue;
    }

    if (char === ')') {
      depth -= 1;
      if (depth === 0) return command;
      command += char;
      continue;
    }

    command += char;
  }

  return '';
}

function processSubstitutionCommands(segment: string, marker: '<' | '>'): string[] {
  const commands: string[] = [];
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < segment.length - 1; index += 1) {
    const char = segment[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char !== marker || segment[index + 1] !== '(' || isEscaped(segment, index)) continue;

    const command = readSubstitutionCommand(segment, index + 2);
    if (command) commands.push(command);
  }

  return commands;
}

function containsProcessSubstitutionCommand(
  segment: string,
  marker: '<' | '>',
  matchesCommand: (command: string) => boolean,
): boolean {
  return processSubstitutionCommands(segment, marker).some(matchesCommand);
}

export function inputProcessSubstitutionCommands(segment: string): string[] {
  return processSubstitutionCommands(segment, '<');
}

export function inputProcessSubstitutionCommandsForFdRedirect(segment: string, fd: number): string[] {
  const commands: string[] = [];
  let quote: '"' | "'" | null = null;
  const fdPrefix = `${fd}<`;

  for (let index = 0; index < segment.length - fdPrefix.length; index += 1) {
    const char = segment[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (!segment.startsWith(fdPrefix, index) || isEscaped(segment, index)) continue;
    let cursor = index + fdPrefix.length;
    while (/\s/.test(segment[cursor] ?? '')) cursor += 1;
    if (segment[cursor] !== '<' || segment[cursor + 1] !== '(') continue;

    const command = readSubstitutionCommand(segment, cursor + 2);
    if (command) commands.push(command);
  }

  return commands;
}

export function containsInputProcessSubstitutionCommand(
  segment: string,
  matchesCommand: (command: string) => boolean,
): boolean {
  return containsProcessSubstitutionCommand(segment, '<', matchesCommand);
}

export function containsOutputProcessSubstitutionCommand(
  segment: string,
  matchesCommand: (command: string) => boolean,
): boolean {
  return containsProcessSubstitutionCommand(segment, '>', matchesCommand);
}

export function containsCommandSubstitutionCommand(
  segment: string,
  matchesCommand: (command: string) => boolean,
): boolean {
  let singleQuote = false;

  for (let index = 0; index < segment.length - 1; index += 1) {
    const char = segment[index];
    if (singleQuote) {
      if (char === "'") singleQuote = false;
      continue;
    }

    if (char === "'") {
      singleQuote = true;
      continue;
    }

    if (char !== '$' || segment[index + 1] !== '(' || isEscaped(segment, index)) continue;

    const command = readSubstitutionCommand(segment, index + 2);
    if (command && matchesCommand(command)) return true;
  }

  return false;
}

export function containsBacktickCommandSubstitutionCommand(
  segment: string,
  matchesCommand: (command: string) => boolean,
): boolean {
  let singleQuote = false;

  for (let index = 0; index < segment.length; index += 1) {
    const char = segment[index];
    if (singleQuote) {
      if (char === "'") singleQuote = false;
      continue;
    }

    if (char === "'") {
      singleQuote = true;
      continue;
    }

    if (char !== '`' || isEscaped(segment, index)) continue;

    let command = '';
    for (let commandIndex = index + 1; commandIndex < segment.length; commandIndex += 1) {
      const commandChar = segment[commandIndex];
      if (commandChar === '`' && !isEscaped(segment, commandIndex)) {
        if (command && matchesCommand(command)) return true;
        index = commandIndex;
        break;
      }
      command += commandChar;
    }
  }

  return false;
}
