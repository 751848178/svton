const PYTHON_NAME_PATTERN = '[A-Za-z_][A-Za-z0-9_]*';

export function pythonModuleCallNames(code: string, moduleName: string, functionNames: string[]): string[] {
  const names = new Set<string>();
  for (const importedModuleName of pythonModuleNames(code, moduleName)) {
    for (const functionName of functionNames) names.add(`${importedModuleName}.${functionName}`);
  }
  for (const importedName of pythonImportedNames(code, moduleName, new Set(functionNames))) {
    names.add(importedName);
  }
  return [...names];
}

function pythonModuleNames(code: string, moduleName: string): string[] {
  const names = new Set([moduleName]);
  for (const imports of importStatementBodies(code)) {
    for (const spec of imports.split(',')) {
      const match = spec.trim().match(new RegExp(`^${moduleName}(?:\\s+as\\s+(${PYTHON_NAME_PATTERN}))?$`));
      if (match) names.add(match[1] ?? moduleName);
    }
  }
  return [...names];
}

function pythonImportedNames(code: string, moduleName: string, functionNames: Set<string>): string[] {
  const names = new Set<string>();
  const pattern = new RegExp(`(?:^|[;\\n])\\s*from\\s+${moduleName}\\s+import\\s+([^;\\n]+)`, 'g');
  for (const match of code.matchAll(pattern)) {
    for (const spec of match[1].split(',')) {
      const imported = importedFunctionName(spec.trim());
      if (imported && functionNames.has(imported.name)) names.add(imported.alias);
    }
  }
  return [...names];
}

function importStatementBodies(code: string): string[] {
  return [...code.matchAll(/(?:^|[;\n])\s*import\s+([^;\n]+)/g)]
    .map((match) => match[1]);
}

function importedFunctionName(spec: string): { name: string; alias: string } | null {
  const match = spec.match(new RegExp(`^(${PYTHON_NAME_PATTERN})(?:\\s+as\\s+(${PYTHON_NAME_PATTERN}))?$`));
  if (!match) return null;
  return { name: match[1], alias: match[2] ?? match[1] };
}
