import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const repoRoot = path.resolve(__dirname, '../..');
export const skillsRoot = path.join(repoRoot, 'skills');
export const codexHome = process.env.CODEX_HOME
  ? path.resolve(process.env.CODEX_HOME)
  : path.join(os.homedir(), '.codex');
export const skillCreatorScriptsDir = path.join(codexHome, 'skills', '.system', 'skill-creator', 'scripts');

const REQUIRED_ARRAY_FIELDS = [
  ['whenToUse', 3],
  ['triggerSignals', 3],
  ['workflow', 4],
  ['preferredMoves', 4],
  ['rules', 5],
  ['reviewChecklist', 4],
];
const INTERFACE_FIELDS = [
  ['displayName', 'display_name'],
  ['shortDescription', 'short_description'],
  ['iconSmall', 'icon_small'],
  ['iconLarge', 'icon_large'],
  ['brandColor', 'brand_color'],
  ['defaultPrompt', 'default_prompt'],
];

export function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function listSkillNames() {
  return fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'scripts')
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(skillsRoot, name, 'skill.config.json')))
    .sort();
}

export function getSkillPaths(skillName) {
  const packageDir = path.join(skillsRoot, skillName);

  return {
    packageDir,
    packageJsonPath: path.join(packageDir, 'package.json'),
    configPath: path.join(packageDir, 'skill.config.json'),
    sourceSkillMdPath: path.join(packageDir, 'SKILL.md'),
    sourceOpenAIYamlPath: path.join(packageDir, 'agents', 'openai.yaml'),
    sourceReferencesDir: path.join(packageDir, 'references'),
  };
}

export function loadSkill(skillName) {
  const paths = getSkillPaths(skillName);

  return {
    skillName,
    paths,
    packageJson: loadJson(paths.packageJsonPath),
    config: loadJson(paths.configPath),
  };
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeLines(markdown) {
  return markdown.replace(/\r\n/g, '\n');
}

function yamlQuote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function buildInterfaceEntries(config) {
  if (!config.interface) {
    return [];
  }

  return INTERFACE_FIELDS.flatMap(([sourceKey, targetKey]) => {
    const value = config.interface[sourceKey];
    if (!isNonEmptyString(value)) {
      return [];
    }

    return [[targetKey, value.trim()]];
  });
}

export function renderOpenAIYaml(config) {
  const interfaceEntries = buildInterfaceEntries(config);

  if (interfaceEntries.length === 0) {
    return null;
  }

  return normalizeLines(
    `interface:\n${interfaceEntries.map(([key, value]) => `  ${key}: ${yamlQuote(value)}`).join('\n')}\n`,
  );
}

function getSkillCreatorScriptPath(scriptName) {
  return path.join(skillCreatorScriptsDir, scriptName);
}

function runPythonSkillCreatorScript(scriptName, args) {
  const scriptPath = getSkillCreatorScriptPath(scriptName);

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`skill-creator script not found: ${scriptPath}`);
  }

  return execFileSync('python3', [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function formatProcessError(error) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const parts = [error.message];

  if ('stdout' in error && typeof error.stdout === 'string' && error.stdout.trim()) {
    parts.push(error.stdout.trim());
  }

  if ('stderr' in error && typeof error.stderr === 'string' && error.stderr.trim()) {
    parts.push(error.stderr.trim());
  }

  return parts.join(' | ');
}

function stripYamlQuotes(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const quote = trimmed[0];
    if ((quote === '"' || quote === "'") && trimmed.at(-1) === quote) {
      const inner = trimmed.slice(1, -1);
      if (quote === '"') {
        return inner.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
      return inner;
    }
  }
  return trimmed;
}

function parseSkillFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return { error: 'No YAML frontmatter found' };
  }

  const frontmatterText = match[1];
  const frontmatter = {};
  const topLevelKeys = [];

  for (const rawLine of frontmatterText.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim() || line.trimStart().startsWith('#')) {
      continue;
    }

    if (/^\s/.test(line)) {
      continue;
    }

    const keyMatch = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!keyMatch) {
      return { error: `Invalid frontmatter line: ${line}` };
    }

    const [, key, rawValue = ''] = keyMatch;
    topLevelKeys.push(key);
    frontmatter[key] = stripYamlQuotes(rawValue);
  }

  return {
    frontmatter,
    topLevelKeys,
  };
}

function validateAgainstStandardQuickRules(skillDir) {
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    return { ok: false, message: 'SKILL.md not found' };
  }

  const content = fs.readFileSync(skillMdPath, 'utf8');
  if (!content.startsWith('---')) {
    return { ok: false, message: 'No YAML frontmatter found' };
  }

  const parsed = parseSkillFrontmatter(content);
  if (parsed.error) {
    return { ok: false, message: parsed.error };
  }

  const { frontmatter, topLevelKeys } = parsed;
  const allowedProperties = new Set(['name', 'description', 'license', 'allowed-tools', 'metadata']);
  const unexpectedKeys = topLevelKeys.filter((key) => !allowedProperties.has(key));

  if (unexpectedKeys.length > 0) {
    return {
      ok: false,
      message: `Unexpected key(s) in SKILL.md frontmatter: ${unexpectedKeys.join(', ')}. Allowed properties are: allowed-tools, description, license, metadata, name`,
    };
  }

  if (!Object.hasOwn(frontmatter, 'name')) {
    return { ok: false, message: "Missing 'name' in frontmatter" };
  }

  if (!Object.hasOwn(frontmatter, 'description')) {
    return { ok: false, message: "Missing 'description' in frontmatter" };
  }

  const name = frontmatter.name;
  if (typeof name !== 'string') {
    return { ok: false, message: `Name must be a string, got ${typeof name}` };
  }

  const trimmedName = name.trim();
  if (!/^[a-z0-9-]+$/.test(trimmedName)) {
    return {
      ok: false,
      message: `Name '${trimmedName}' should be hyphen-case (lowercase letters, digits, and hyphens only)`,
    };
  }

  if (trimmedName.startsWith('-') || trimmedName.endsWith('-') || trimmedName.includes('--')) {
    return {
      ok: false,
      message: `Name '${trimmedName}' cannot start/end with hyphen or contain consecutive hyphens`,
    };
  }

  if (trimmedName.length > 64) {
    return {
      ok: false,
      message: `Name is too long (${trimmedName.length} characters). Maximum is 64 characters.`,
    };
  }

  const description = frontmatter.description;
  if (typeof description !== 'string') {
    return { ok: false, message: `Description must be a string, got ${typeof description}` };
  }

  const trimmedDescription = description.trim();
  if (trimmedDescription.includes('<') || trimmedDescription.includes('>')) {
    return { ok: false, message: 'Description cannot contain angle brackets (< or >)' };
  }

  if (trimmedDescription.length > 1024) {
    return {
      ok: false,
      message: `Description is too long (${trimmedDescription.length} characters). Maximum is 1024 characters.`,
    };
  }

  return { ok: true, message: 'Skill is valid!' };
}

function syncOpenAIYaml(skill) {
  const { config, paths } = skill;

  if (!config.interface) {
    return null;
  }

  const interfaceEntries = buildInterfaceEntries(config);
  const args = [paths.packageDir, '--name', config.name];

  for (const [key, value] of interfaceEntries) {
    args.push('--interface', `${key}=${value}`);
  }

  runPythonSkillCreatorScript('generate_openai_yaml.py', args);
  return renderOpenAIYaml(config);
}

function runQuickValidate(skillDir) {
  const result = validateAgainstStandardQuickRules(skillDir);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result.message;
}

function validateBuiltSkillDir(dirPath, config, label) {
  const errors = [];

  if (!fs.existsSync(dirPath)) {
    errors.push(`${label} skill directory is missing: ${dirPath}`);
    return errors;
  }

  try {
    runQuickValidate(dirPath);
  } catch (error) {
    errors.push(`${label} quick_validate failed: ${formatProcessError(error)}`);
  }

  for (const reference of config.references ?? []) {
    const absoluteReferencePath = path.join(dirPath, reference.path);
    if (!fs.existsSync(absoluteReferencePath)) {
      errors.push(`${label} is missing reference file: ${reference.path}`);
    }
  }

  if (config.interface && !fs.existsSync(path.join(dirPath, 'agents', 'openai.yaml'))) {
    errors.push(`${label} is missing agents/openai.yaml`);
  }

  return errors;
}

export function renderSkillMarkdown(config, skillName) {
  const referenceLines = config.references.map((reference) => {
    return `- [${reference.title}](${reference.path}) - ${reference.description}`;
  });

  const sections = [
    '## Use When',
    config.whenToUse.map((item) => `- ${item}`).join('\n'),
  ];

  if (Array.isArray(config.avoidWhen) && config.avoidWhen.length > 0) {
    sections.push('## Avoid When');
    sections.push(config.avoidWhen.map((item) => `- ${item}`).join('\n'));
  }

  sections.push('## Trigger Signals');
  sections.push(config.triggerSignals.map((item) => `- ${item}`).join('\n'));
  sections.push('## Default Workflow');
  sections.push(config.workflow.map((item, index) => `${index + 1}. ${item}`).join('\n'));
  sections.push('## Preferred Moves');
  sections.push(config.preferredMoves.map((item) => `- ${item}`).join('\n'));
  sections.push('## Rules');
  sections.push(config.rules.map((item) => `- ${item}`).join('\n'));
  sections.push('## Review Checklist');
  sections.push(config.reviewChecklist.map((item) => `- ${item}`).join('\n'));
  sections.push('## References');
  sections.push(referenceLines.join('\n'));

  return normalizeLines(`---
name: ${config.name}
description: ${yamlQuote(config.description)}
---

<!-- Generated from skills/${skillName}/skill.config.json. Edit skill.config.json instead of this file. -->

# ${config.title}

${config.summary}

${sections.join('\n\n')}
`);
}

export function validateSkill(skill, options = {}) {
  const {
    requireSourceArtifacts = true,
    runStandardValidation = true,
  } = options;
  const { skillName, paths, packageJson, config } = skill;
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(paths.packageJsonPath)) {
    errors.push('missing package.json');
  }

  if (!fs.existsSync(paths.configPath)) {
    errors.push('missing skill.config.json');
  }

  if (!isNonEmptyString(config.name)) {
    errors.push('config.name is required');
  }

  if (config.name !== skillName) {
    errors.push(`config.name "${config.name}" must match directory "${skillName}"`);
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(config.name ?? '')) {
    errors.push('config.name must be lowercase hyphen-case');
  }

  for (const field of ['title', 'description', 'summary']) {
    if (!isNonEmptyString(config[field])) {
      errors.push(`config.${field} is required`);
    }
  }

  if ((config.description ?? '').length > 240) {
    errors.push('config.description must be <= 240 characters');
  }

  if (config.interface) {
    if (!isNonEmptyString(config.interface.displayName)) {
      errors.push('config.interface.displayName is required when config.interface is present');
    }

    if (config.interface.shortDescription && config.interface.shortDescription.length > 64) {
      errors.push('config.interface.shortDescription must be <= 64 characters');
    }

    if (config.interface.shortDescription && config.interface.shortDescription.length < 25) {
      errors.push('config.interface.shortDescription must be >= 25 characters');
    }

    if (!isNonEmptyString(config.interface.shortDescription)) {
      errors.push('config.interface.shortDescription is required when config.interface is present');
    }

    if (config.interface.defaultPrompt && !config.interface.defaultPrompt.includes(`$${config.name}`)) {
      errors.push(`config.interface.defaultPrompt must mention $${config.name}`);
    }

    if (!isNonEmptyString(config.interface.defaultPrompt)) {
      errors.push('config.interface.defaultPrompt is required when config.interface is present');
    }

    for (const iconField of ['iconSmall', 'iconLarge']) {
      if (config.interface[iconField] !== undefined && !isNonEmptyString(config.interface[iconField])) {
        errors.push(`config.interface.${iconField} must be a non-empty string when present`);
      }
    }

    if (
      config.interface.brandColor !== undefined &&
      !/^#[0-9A-Fa-f]{6}$/.test(config.interface.brandColor)
    ) {
      errors.push('config.interface.brandColor must be a hex color like #3B82F6');
    }
  }

  for (const [field, minItems] of REQUIRED_ARRAY_FIELDS) {
    if (!Array.isArray(config[field]) || config[field].length < minItems) {
      errors.push(`config.${field} must contain at least ${minItems} items`);
      continue;
    }

    const invalidItem = config[field].find((item) => !isNonEmptyString(item));
    if (invalidItem !== undefined) {
      errors.push(`config.${field} must contain only non-empty strings`);
    }
  }

  if (config.avoidWhen !== undefined) {
    if (!Array.isArray(config.avoidWhen) || config.avoidWhen.length < 2) {
      errors.push('config.avoidWhen must contain at least 2 items when present');
    } else {
      const invalidItem = config.avoidWhen.find((item) => !isNonEmptyString(item));
      if (invalidItem !== undefined) {
        errors.push('config.avoidWhen must contain only non-empty strings');
      }
    }
  }

  if (!Array.isArray(config.references) || config.references.length < 2) {
    errors.push('config.references must contain at least 2 items');
  } else {
    let hasDemoReference = false;

    for (const reference of config.references) {
      if (
        !reference ||
        !isNonEmptyString(reference.title) ||
        !isNonEmptyString(reference.path) ||
        !isNonEmptyString(reference.description)
      ) {
        errors.push('each reference must have title, path, and description');
        continue;
      }

      if (!reference.path.startsWith('references/') || !reference.path.endsWith('.md')) {
        errors.push(`reference path must be inside references and end with .md: ${reference.path}`);
      }

      const absoluteReferencePath = path.join(paths.packageDir, reference.path);
      if (!fs.existsSync(absoluteReferencePath)) {
        errors.push(`missing reference file: ${reference.path}`);
      }

      if (/demo|example/i.test(reference.title) || /demo|example/i.test(reference.path)) {
        hasDemoReference = true;
      }
    }

    if (!hasDemoReference) {
      warnings.push('consider adding a demo/examples reference for forward-testing');
    }
  }

  const expectedPackageName = `@svton/skill-${skillName}`;
  if (packageJson.name !== expectedPackageName) {
    errors.push(`package.json name must be ${expectedPackageName}`);
  }

  const rendered = renderSkillMarkdown(config, skillName);
  const lineCount = rendered.split('\n').length;

  if (lineCount > 180) {
    errors.push(`generated SKILL.md is too long: ${lineCount} lines (max 180)`);
  }

  if (requireSourceArtifacts && !fs.existsSync(paths.sourceSkillMdPath)) {
    errors.push('source SKILL.md is missing; run the skill build first');
  } else if (requireSourceArtifacts && fs.existsSync(paths.sourceSkillMdPath)) {
    const sourceSkillMd = fs.readFileSync(paths.sourceSkillMdPath, 'utf8');
    if (sourceSkillMd !== rendered) {
      errors.push('source SKILL.md is out of date with skill.config.json; rebuild the skill');
    }
  }

  const expectedOpenAIYaml = renderOpenAIYaml(config);

  if (requireSourceArtifacts && config.interface && !fs.existsSync(paths.sourceOpenAIYamlPath)) {
    errors.push('agents/openai.yaml is missing; rebuild the skill to regenerate it');
  } else if (requireSourceArtifacts && expectedOpenAIYaml && fs.existsSync(paths.sourceOpenAIYamlPath)) {
    const sourceOpenAIYaml = fs.readFileSync(paths.sourceOpenAIYamlPath, 'utf8');
    if (sourceOpenAIYaml !== expectedOpenAIYaml) {
      errors.push('agents/openai.yaml is out of date with skill.config.json; rebuild the skill');
    }
  }

  if (!rendered.includes('## Trigger Signals')) {
    errors.push('generated SKILL.md must include Trigger Signals section');
  }

  if (!rendered.includes('## References')) {
    errors.push('generated SKILL.md must include References section');
  }

  if (runStandardValidation && fs.existsSync(paths.packageDir)) {
    errors.push(...validateBuiltSkillDir(paths.packageDir, config, 'source'));
  }

  return {
    errors,
    warnings,
    rendered,
    lineCount,
  };
}

export function buildSkill(skill) {
  const validation = validateSkill(skill, {
    requireSourceArtifacts: false,
    runStandardValidation: false,
  });

  if (validation.errors.length > 0) {
    return validation;
  }

  const { skillName, paths, config } = skill;

  fs.mkdirSync(path.dirname(paths.sourceSkillMdPath), { recursive: true });

  fs.writeFileSync(paths.sourceSkillMdPath, validation.rendered);

  try {
    syncOpenAIYaml(skill);
  } catch (error) {
    return {
      ...validation,
      errors: [...validation.errors, `failed to generate agents/openai.yaml: ${formatProcessError(error)}`],
    };
  }

  return validateSkill(loadSkill(skillName));
}
