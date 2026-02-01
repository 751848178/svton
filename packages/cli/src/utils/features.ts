import fs from 'fs-extra';
import path from 'path';
import { logger } from './logger';

export interface FeatureConfig {
  name: string;
  description: string;
  category: string;
  packages: {
    dependencies: Record<string, string>;
  };
  envVars: Array<{
    key: string;
    default: string;
    description?: string;
  }>;
  configFiles: Array<{
    path: string;
    template: string;
  }>;
  moduleImports: Array<{
    from: string;
    import: string;
  }>;
  moduleRegistration: {
    type: string;
    module: string;
    config: string;
  };
  exampleFiles: {
    source: string;
    target: string;
    description: string;
  };
  skillFile: {
    template: string;
    target: string;
  };
}

export interface FeaturesConfig {
  features: Record<string, FeatureConfig>;
}

/**
 * 加载功能配置
 */
export async function loadFeaturesConfig(): Promise<FeaturesConfig> {
  // 在发布的包中，features.json 在包根目录
  // __dirname 在编译后指向 dist 目录，所以需要向上一级
  const configPath = path.join(__dirname, '../features.json');
  
  // 如果找不到，尝试开发环境的路径
  if (!fs.existsSync(configPath)) {
    const devPath = path.join(__dirname, '../../features.json');
    if (fs.existsSync(devPath)) {
      return await fs.readJSON(devPath);
    }
  }
  
  return await fs.readJSON(configPath);
}

/**
 * 获取功能列表（用于交互式选择）
 */
export function getFeatureChoices(config: FeaturesConfig) {
  return Object.entries(config.features).map(([key, feature]) => ({
    name: `${feature.name} - ${feature.description}`,
    value: key,
    checked: false,
  }));
}

/**
 * 收集所有选中功能的依赖包
 */
export function collectDependencies(
  features: string[],
  config: FeaturesConfig,
): Record<string, string> {
  const dependencies: Record<string, string> = {};

  for (const featureKey of features) {
    const feature = config.features[featureKey];
    if (feature) {
      Object.assign(dependencies, feature.packages.dependencies);
    }
  }

  return dependencies;
}

/**
 * 收集所有选中功能的环境变量
 */
export function collectEnvVars(
  features: string[],
  config: FeaturesConfig,
): Array<{ key: string; default: string; description?: string }> {
  const envVars: Array<{ key: string; default: string; description?: string }> = [];
  const seen = new Set<string>();

  for (const featureKey of features) {
    const feature = config.features[featureKey];
    if (feature) {
      for (const envVar of feature.envVars) {
        if (!seen.has(envVar.key)) {
          envVars.push(envVar);
          seen.add(envVar.key);
        }
      }
    }
  }

  return envVars;
}

/**
 * 生成 .env.example 文件
 */
export async function generateEnvExample(
  features: string[],
  config: FeaturesConfig,
  targetPath: string,
): Promise<void> {
  const envVars = collectEnvVars(features, config);

  const content = [
    '# Environment Variables',
    '# Copy this file to .env and fill in the values',
    '',
    ...envVars.map((envVar) => {
      const lines: string[] = [];
      if (envVar.description) {
        lines.push(`# ${envVar.description}`);
      }
      lines.push(`${envVar.key}=${envVar.default}`);
      lines.push('');
      return lines.join('\n');
    }),
  ].join('\n');

  await fs.writeFile(path.join(targetPath, '.env.example'), content);
  logger.info('Generated .env.example');
}

/**
 * 复制配置文件
 */
export async function copyConfigFiles(
  features: string[],
  config: FeaturesConfig,
  templatePath: string,
  targetPath: string,
): Promise<void> {
  for (const featureKey of features) {
    const feature = config.features[featureKey];
    if (feature && feature.configFiles) {
      for (const configFile of feature.configFiles) {
        const sourcePath = path.join(templatePath, configFile.template);
        const destPath = path.join(targetPath, configFile.path);

        await fs.ensureDir(path.dirname(destPath));
        await fs.copy(sourcePath, destPath);
        logger.info(`Copied config: ${configFile.path}`);
      }
    }
  }
}

/**
 * 复制示例代码
 */
export async function copyExampleFiles(
  features: string[],
  config: FeaturesConfig,
  templatePath: string,
  targetPath: string,
): Promise<void> {
  for (const featureKey of features) {
    const feature = config.features[featureKey];
    if (feature && feature.exampleFiles) {
      const sourcePath = path.join(templatePath, feature.exampleFiles.source);
      const destPath = path.join(targetPath, feature.exampleFiles.target);

      if (await fs.pathExists(sourcePath)) {
        await fs.ensureDir(path.dirname(destPath));
        await fs.copy(sourcePath, destPath);
        logger.info(`Copied examples: ${feature.exampleFiles.target}`);
      }
    }
  }
}

/**
 * 复制 Skill 文件
 */
export async function copySkillFiles(
  features: string[],
  config: FeaturesConfig,
  templatePath: string,
  targetPath: string,
): Promise<void> {
  // 确保 .kiro/skills 目录存在
  const skillsDir = path.join(targetPath, '.kiro/skills');
  await fs.ensureDir(skillsDir);

  // 复制基础 skill
  const baseSkillSource = path.join(templatePath, 'skills/base.skill.md');
  const baseSkillDest = path.join(skillsDir, 'project-capabilities.md');
  if (await fs.pathExists(baseSkillSource)) {
    await fs.copy(baseSkillSource, baseSkillDest);
    logger.info('Copied base skill file');
  }

  // 复制功能 skill 文件
  for (const featureKey of features) {
    const feature = config.features[featureKey];
    if (feature && feature.skillFile) {
      const sourcePath = path.join(templatePath, feature.skillFile.template);
      const destPath = path.join(targetPath, feature.skillFile.target);

      if (await fs.pathExists(sourcePath)) {
        await fs.ensureDir(path.dirname(destPath));
        await fs.copy(sourcePath, destPath);
        logger.info(`Copied skill: ${feature.skillFile.target}`);
      }
    }
  }

  // 生成功能索引
  await generateCapabilitiesIndex(features, config, targetPath);
}

/**
 * 生成功能索引文件
 */
async function generateCapabilitiesIndex(
  features: string[],
  config: FeaturesConfig,
  targetPath: string,
): Promise<void> {
  const featuresList = features
    .map((featureKey) => {
      const feature = config.features[featureKey];
      if (!feature) return '';

      const packages = Object.keys(feature.packages.dependencies).join(', ');
      return `### ${feature.name}

${feature.description}

- 📦 包：${packages}
- 📝 示例代码：\`${feature.exampleFiles.target}\`
- 📚 详细文档：查看 \`.kiro/skills/${featureKey}.md\`
`;
    })
    .join('\n');

  const content = `# 项目能力索引

本项目基于 Svton 框架创建，已集成以下功能模块：

## 已启用的功能

${featuresList}

## 使用建议

当你需要使用某个功能时，可以：

1. 查看对应的 skill 文档了解 API 和最佳实践
2. 参考 \`src/examples/\` 目录下的示例代码
3. 查看官方文档获取更多信息

## 文档资源

- Svton 官方文档：https://751848178.github.io/svton
- GitHub：https://github.com/751848178/svton
`;

  const indexPath = path.join(targetPath, '.kiro/skills/project-capabilities.md');
  await fs.writeFile(indexPath, content);
  logger.info('Generated capabilities index');
}

/**
 * 更新 package.json 添加依赖
 */
export async function updatePackageJson(
  features: string[],
  config: FeaturesConfig,
  targetPath: string,
): Promise<void> {
  const packageJsonPath = path.join(targetPath, 'package.json');
  const packageJson = await fs.readJSON(packageJsonPath);

  const dependencies = collectDependencies(features, config);

  packageJson.dependencies = {
    ...packageJson.dependencies,
    ...dependencies,
  };

  await fs.writeJSON(packageJsonPath, packageJson, { spaces: 2 });
  logger.info('Updated package.json with feature dependencies');
}

/**
 * 生成模块导入代码
 */
export function generateModuleImports(
  features: string[],
  config: FeaturesConfig,
): string {
  const imports: string[] = [];

  for (const featureKey of features) {
    const feature = config.features[featureKey];
    if (feature && feature.moduleImports) {
      for (const moduleImport of feature.moduleImports) {
        imports.push(`import { ${moduleImport.import} } from '${moduleImport.from}';`);
      }
    }
  }

  return imports.join('\n');
}

/**
 * 生成模块注册代码
 */
export function generateModuleRegistrations(
  features: string[],
  config: FeaturesConfig,
): string {
  const registrations: string[] = [];

  for (const featureKey of features) {
    const feature = config.features[featureKey];
    if (feature && feature.moduleRegistration) {
      const { module: moduleName, config: moduleConfig } = feature.moduleRegistration;
      registrations.push(`    ${moduleName}.${feature.moduleRegistration.type}({
      useFactory: (configService: ConfigService) => ${moduleConfig},
      inject: [ConfigService],
    }),`);
    }
  }

  return registrations.join('\n');
}

/**
 * 更新 app.module.ts 注入模块
 */
export async function updateAppModule(
  features: string[],
  config: FeaturesConfig,
  targetPath: string,
): Promise<void> {
  const appModulePath = path.join(targetPath, 'src/app.module.ts');

  if (!(await fs.pathExists(appModulePath))) {
    logger.warn('app.module.ts not found, skipping module injection');
    return;
  }

  let content = await fs.readFile(appModulePath, 'utf-8');

  // 生成导入语句
  const imports = generateModuleImports(features, config);

  // 生成模块注册
  const registrations = generateModuleRegistrations(features, config);

  // 在 imports 数组中添加模块
  // 这里使用简单的字符串替换，实际项目中可能需要更复杂的 AST 操作
  const importsMatch = content.match(/imports:\s*\[([\s\S]*?)\]/);
  if (importsMatch) {
    const existingImports = importsMatch[1];
    const newImports = `${existingImports}\n${registrations}`;
    content = content.replace(
      /imports:\s*\[([\s\S]*?)\]/,
      `imports: [${newImports}\n  ]`,
    );
  }

  // 添加 import 语句到文件顶部
  const lastImportIndex = content.lastIndexOf('import ');
  const lastImportEnd = content.indexOf('\n', lastImportIndex);
  content =
    content.slice(0, lastImportEnd + 1) +
    imports +
    '\n' +
    content.slice(lastImportEnd + 1);

  await fs.writeFile(appModulePath, content);
  logger.info('Updated app.module.ts with feature modules');
}
