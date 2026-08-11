const ALLOWED_EXECUTABLES = new Set([
  "bun",
  "nest",
  "next",
  "node",
  "npm",
  "npx",
  "pnpm",
  "taro",
  "true",
  "tsc",
  "yarn",
]);

export function parseControlledBuildArgv(command: string) {
  const argv: string[] = [];
  let token = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;
  for (const character of command.trim()) {
    if (escaped) {
      token += character;
      escaped = false;
    } else if (character === "\\" && quote !== "'") {
      escaped = true;
    } else if (quote) {
      if (character === quote) quote = null;
      else token += character;
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (/[$`;&|<>\r\n\0]/.test(character)) {
      throw new Error("BUILD_COMMAND_SHELL_SYNTAX_REJECTED");
    } else if (/\s/.test(character)) {
      if (token) argv.push(token);
      token = "";
    } else {
      token += character;
    }
  }
  if (escaped || quote) throw new Error("BUILD_COMMAND_QUOTE_INVALID");
  if (token) argv.push(token);
  const executable = argv.shift();
  if (!executable || !ALLOWED_EXECUTABLES.has(executable)) {
    throw new Error("BUILD_COMMAND_EXECUTABLE_NOT_ALLOWED");
  }
  return { executable, args: argv };
}
