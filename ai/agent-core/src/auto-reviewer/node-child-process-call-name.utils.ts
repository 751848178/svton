const JS_NAME_PATTERN = '[A-Za-z_$][A-Za-z0-9_$]*';
const CHILD_PROCESS_MODULE_PATTERN = '[\\\'"](?:node:)?child_process[\\\'"]';
const CHILD_PROCESS_REQUIRE_PATTERN = `require\\(\\s*${CHILD_PROCESS_MODULE_PATTERN}\\s*\\)`;

export function nodeChildProcessCallNames(code: string, functionNames: string[]): string[] {
  const allowedNames = new Set(functionNames);
  const names = new Set(functionNames);

  for (const alias of propertyAssignmentAliases(code, allowedNames)) names.add(alias);
  for (const alias of destructuringAliases(code, allowedNames)) names.add(alias);
  for (const alias of namedImportAliases(code, allowedNames)) names.add(alias);

  return [...names];
}

export function nodeChildProcessBracketCallStartIndexes(code: string, functionNames: string[]): number[] {
  const allowedNames = new Set(functionNames);
  const indexes = [
    ...directRequireBracketCallStartIndexes(code, allowedNames),
  ];

  for (const moduleName of moduleAliases(code)) {
    indexes.push(...moduleAliasBracketCallStartIndexes(code, moduleName, allowedNames));
  }

  return indexes;
}

function moduleAliases(code: string): string[] {
  const names = new Set<string>();
  const requirePattern = new RegExp(
    `(?:^|[;\\n])\\s*(?:const|let|var)\\s+(${JS_NAME_PATTERN})\\s*=\\s*${CHILD_PROCESS_REQUIRE_PATTERN}`,
    'g',
  );
  const namespaceImportPattern = new RegExp(
    `(?:^|[;\\n])\\s*import\\s+\\*\\s+as\\s+(${JS_NAME_PATTERN})\\s+from\\s+${CHILD_PROCESS_MODULE_PATTERN}`,
    'g',
  );

  for (const match of code.matchAll(requirePattern)) {
    names.add(match[1]);
  }
  for (const match of code.matchAll(namespaceImportPattern)) {
    names.add(match[1]);
  }

  return [...names];
}

function propertyAssignmentAliases(code: string, allowedNames: Set<string>): string[] {
  const names = new Set<string>();
  const pattern = new RegExp(
    `(?:^|[;\\n])\\s*(?:const|let|var)\\s+(${JS_NAME_PATTERN})\\s*=\\s*${CHILD_PROCESS_REQUIRE_PATTERN}\\s*(?:\\.\\s*(${functionAlternation(allowedNames)})\\b|\\[\\s*[\\'"](${functionAlternation(allowedNames)})[\\'"]\\s*\\])`,
    'g',
  );

  for (const match of code.matchAll(pattern)) {
    names.add(match[1]);
  }

  return [...names];
}

function destructuringAliases(code: string, allowedNames: Set<string>): string[] {
  const names = new Set<string>();
  const pattern = new RegExp(
    `(?:^|[;\\n])\\s*(?:const|let|var)\\s*\\{([^}]+)\\}\\s*=\\s*${CHILD_PROCESS_REQUIRE_PATTERN}`,
    'g',
  );

  for (const match of code.matchAll(pattern)) {
    for (const spec of match[1].split(',')) {
      const alias = destructuredAlias(spec.trim(), allowedNames);
      if (alias) names.add(alias);
    }
  }

  return [...names];
}

function namedImportAliases(code: string, allowedNames: Set<string>): string[] {
  const names = new Set<string>();
  const pattern = new RegExp(
    `(?:^|[;\\n])\\s*import\\s*\\{([^}]+)\\}\\s*from\\s+${CHILD_PROCESS_MODULE_PATTERN}`,
    'g',
  );

  for (const match of code.matchAll(pattern)) {
    for (const spec of match[1].split(',')) {
      const alias = importedAlias(spec.trim(), allowedNames);
      if (alias) names.add(alias);
    }
  }

  return [...names];
}

function directRequireBracketCallStartIndexes(code: string, allowedNames: Set<string>): number[] {
  const pattern = new RegExp(
    `${CHILD_PROCESS_REQUIRE_PATTERN}\\s*\\[\\s*[\\'"](${functionAlternation(allowedNames)})[\\'"]\\s*\\]\\s*\\(`,
    'g',
  );
  return callEndIndexes(code, pattern);
}

function moduleAliasBracketCallStartIndexes(code: string, moduleName: string, allowedNames: Set<string>): number[] {
  const pattern = new RegExp(
    `(?:^|[^A-Za-z0-9_$])${escapePattern(moduleName)}\\s*\\[\\s*[\\'"](${functionAlternation(allowedNames)})[\\'"]\\s*\\]\\s*\\(`,
    'g',
  );
  return callEndIndexes(code, pattern);
}

function destructuredAlias(spec: string, allowedNames: Set<string>): string | null {
  const renamed = spec.match(new RegExp(`^(${JS_NAME_PATTERN})\\s*:\\s*(${JS_NAME_PATTERN})$`));
  if (renamed && allowedNames.has(renamed[1])) return renamed[2];

  const direct = spec.match(new RegExp(`^(${JS_NAME_PATTERN})$`));
  if (direct && allowedNames.has(direct[1])) return direct[1];

  return null;
}

function importedAlias(spec: string, allowedNames: Set<string>): string | null {
  const imported = spec.match(new RegExp(`^(${JS_NAME_PATTERN})(?:\\s+as\\s+(${JS_NAME_PATTERN}))?$`));
  if (imported && allowedNames.has(imported[1])) return imported[2] ?? imported[1];

  return null;
}

function functionAlternation(functionNames: Set<string>): string {
  return [...functionNames]
    .map(escapePattern)
    .join('|');
}

function callEndIndexes(code: string, pattern: RegExp): number[] {
  return [...code.matchAll(pattern)]
    .map((match) => Number(match.index) + match[0].length);
}

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
