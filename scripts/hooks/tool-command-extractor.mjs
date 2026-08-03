function decodeStaticLiteral(literal) {
  const quote = literal[0];
  const body = literal.slice(1, -1);
  if (quote === "`" && body.includes("${")) return null;
  if (quote === '"') {
    try {
      return JSON.parse(literal);
    } catch {
      return null;
    }
  }

  return body.replace(/\\(['"`\\nrt])/g, (_, escaped) => {
    if (escaped === "n") return "\n";
    if (escaped === "r") return "\r";
    if (escaped === "t") return "\t";
    return escaped;
  });
}

function nestedExecCommands(source) {
  const commands = [];
  const pattern =
    /tools\.(?:exec_command|mcp__[\w]+__exec_command)\s*\(\s*\{[\s\S]*?(?:["']?cmd["']?)\s*:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const decoded = decodeStaticLiteral(match[1]);
    if (decoded?.trim()) commands.push(decoded);
  }
  return commands;
}

function sourceStrings(toolInput) {
  if (typeof toolInput === "string") return [toolInput];
  if (!toolInput || typeof toolInput !== "object") return [];
  return ["input", "source", "code", "script"]
    .map((key) => toolInput[key])
    .filter((value) => typeof value === "string");
}

function isShellTool(toolName) {
  return /^(?:Bash|exec_command|mcp__[\w]+__exec_command)$/.test(toolName);
}

function isExecOrchestrator(toolName) {
  return /^(?:(?:functions\.)?exec|js)$/.test(toolName);
}

export function extractShellCommands(payload) {
  const toolName = String(payload?.tool_name ?? payload?.toolName ?? "");
  const toolInput = payload?.tool_input ?? payload?.toolInput;
  const commands = [];

  if (toolInput && typeof toolInput === "object") {
    for (const key of ["command", "cmd"]) {
      const value = toolInput[key];
      if (typeof value === "string" && value.trim()) commands.push(value);
    }
  } else if (typeof toolInput === "string" && isShellTool(toolName)) {
    commands.push(toolInput);
  }

  if (isExecOrchestrator(toolName)) {
    for (const source of sourceStrings(toolInput)) {
      commands.push(...nestedExecCommands(source));
    }
  }

  return [
    ...new Set(commands.map((command) => command.trim()).filter(Boolean)),
  ];
}
