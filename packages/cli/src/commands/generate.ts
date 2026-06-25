import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { findProjectRoot } from '../utils/project-root';
import { loadManifest } from '../config/loader';
import { SvtonAppConfig } from '../config/types';
import { updateAppModuleFile } from '../utils/ast-helper';

export interface GenerateOptions {
  app?: string;
  dryRun?: boolean;
  force?: boolean;
}

const KINDS = ['module', 'app', 'package', 'api-contract'] as const;
const SUPPORTED = ['module'] as const;

/** kebab/lower 名称 → PascalCase：`users`→`Users`，`user-profile`→`UserProfile`。 */
export function toPascalCase(name: string): string {
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join('');
}

export function normalizeModuleName(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const MODULE_TPL = `import { Module } from '@nestjs/common';
import { {{MODULE_CLASS}}Controller } from './{{MODULE_NAME}}.controller';
import { {{MODULE_CLASS}}Service } from './{{MODULE_NAME}}.service';

@Module({
  controllers: [{{MODULE_CLASS}}Controller],
  providers: [{{MODULE_CLASS}}Service],
})
export class {{MODULE_CLASS}}Module {}
`;

const CONTROLLER_TPL = `import { Controller, Get } from '@nestjs/common';
import { {{MODULE_CLASS}}Service } from './{{MODULE_NAME}}.service';

@Controller('{{MODULE_NAME}}')
export class {{MODULE_CLASS}}Controller {
  constructor(private readonly service: {{MODULE_CLASS}}Service) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
`;

const SERVICE_TPL = `import { Injectable } from '@nestjs/common';

@Injectable()
export class {{MODULE_CLASS}}Service {
  findAll() {
    return [];
  }
}
`;

const DTO_TPL = `// {{MODULE_CLASS}} data-transfer objects (add Create{{MODULE_CLASS}}Dto / Update{{MODULE_CLASS}}Dto here)
`;

function render(tpl: string, moduleName: string, pascal: string): string {
  return tpl.replace(/\{\{MODULE_NAME\}\}/g, moduleName).replace(/\{\{MODULE_CLASS\}\}/g, pascal);
}

/** `svton generate <kind> [name]` action。 */
export async function generate(kind: string, name: string | undefined, options: GenerateOptions = {}): Promise<void> {
  if (!KINDS.includes(kind as any)) {
    logger.error(`Unknown generator: ${kind}`);
    logger.info(`Available: ${KINDS.join(', ')}`);
    process.exit(1);
  }
  if (!SUPPORTED.includes(kind as any)) {
    logger.warn(`Generator "${kind}" is not implemented yet (planned). Currently supported: ${SUPPORTED.join(', ')}.`);
    return;
  }
  if (!name) {
    logger.error(`\`generate ${kind}\` requires a name.`);
    process.exit(1);
  }
  await generateModule(name, options);
}

async function generateModule(rawName: string, options: GenerateOptions): Promise<void> {
  const root = await findProjectRoot();
  const manifest = await loadManifest(root);

  const nestApps = Object.entries(manifest.apps).filter(([, a]) => a.type === 'nest');
  if (nestApps.length === 0) {
    logger.error('No NestJS app found in the project.');
    process.exit(1);
  }

  let appEntry: [string, SvtonAppConfig] | undefined;
  if (options.app) {
    appEntry = nestApps.find(([key]) => key === options.app);
    if (!appEntry) {
      logger.error(`App "${options.app}" not found or not a NestJS app.`);
      logger.info(`NestJS apps: ${nestApps.map(([k]) => k).join(', ')}`);
      process.exit(1);
    }
  } else if (nestApps.length === 1) {
    appEntry = nestApps[0];
  } else {
    logger.error('Multiple NestJS apps found. Specify one with --app.');
    logger.info(`NestJS apps: ${nestApps.map(([k]) => k).join(', ')}`);
    process.exit(1);
  }

  const [appKey, app] = appEntry;
  const moduleName = normalizeModuleName(rawName);
  const pascal = toPascalCase(moduleName);
  if (!moduleName) {
    logger.error(`Invalid module name: ${rawName}`);
    process.exit(1);
  }

  const targetDir = path.join(root, app.dir, 'src', moduleName);
  const files: Record<string, string> = {
    [`${moduleName}.module.ts`]: render(MODULE_TPL, moduleName, pascal),
    [`${moduleName}.controller.ts`]: render(CONTROLLER_TPL, moduleName, pascal),
    [`${moduleName}.service.ts`]: render(SERVICE_TPL, moduleName, pascal),
    [`${moduleName}.dto.ts`]: render(DTO_TPL, moduleName, pascal),
  };

  const appModulePath = path.join(root, app.dir, 'src', 'app.module.ts');
  const importPath = `./${moduleName}/${moduleName}.module`;
  const moduleClass = `${pascal}Module`;

  logger.info(chalk.bold(`Generating module ${chalk.cyan(moduleName)} in ${appKey} …`));

  if (options.dryRun) {
    logger.info(chalk.gray('(dry-run — no files written)'));
    logger.info(`  dir: ${path.relative(root, targetDir)}`);
    for (const f of Object.keys(files)) logger.info(`  - ${f}`);
    if (await fs.pathExists(appModulePath)) {
      logger.info(`  wire: ${path.relative(root, appModulePath)} += import ${moduleClass} & @Module imports`);
    }
    return;
  }

  if ((await fs.pathExists(targetDir)) && !options.force) {
    logger.error(`Directory already exists: ${path.relative(root, targetDir)} (use --force to overwrite)`);
    process.exit(1);
  }

  await fs.ensureDir(targetDir);
  for (const [f, content] of Object.entries(files)) {
    await fs.writeFile(path.join(targetDir, f), content);
    logger.success(`  created ${path.relative(root, path.join(targetDir, f))}`);
  }

  // 接线 app.module.ts
  if (await fs.pathExists(appModulePath)) {
    const existing = await fs.readFile(appModulePath, 'utf8');
    if (existing.includes(moduleClass)) {
      logger.warn(`  ${moduleClass} already referenced in app.module.ts — skipping wiring.`);
    } else {
      await updateAppModuleFile(appModulePath, [{ from: importPath, imports: [moduleClass] }], [moduleClass]);
      logger.success(`  wired ${moduleClass} into app.module.ts`);
    }
  } else {
    logger.warn(`  No app.module.ts at ${path.relative(root, appModulePath)} — skip wiring.`);
  }
}
