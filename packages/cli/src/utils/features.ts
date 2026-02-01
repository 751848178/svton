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
 * 包含所有选中功能的环境变量
 */
export async function generateEnvExample(
  features: string[],
  config: FeaturesConfig,
  targetPath: string,
): Promise<void> {
  const envVars = collectEnvVars(features, config);

  if (envVars.length === 0) {
    return;
  }

  const content = [
    '# ========================================',
    '# Environment Variables',
    '# ========================================',
    '# Copy this file to .env and fill in the values',
    '#',
    '# IMPORTANT: Never commit .env file to version control!',
    '# Add .env to your .gitignore file',
    '#',
    '',
    '# ========================================',
    '# Application Configuration',
    '# ========================================',
    'NODE_ENV=development',
    'PORT=3000',
    '',
    '# ========================================',
    '# Database Configuration',
    '# ========================================',
    'DATABASE_URL=mysql://root:root123456@localhost:3306/{{PROJECT_NAME}}',
    '',
  ];

  // 按功能分组添加环境变量
  const featureGroups: Record<string, Array<{ key: string; default: string; description?: string }>> = {};
  
  for (const featureKey of features) {
    const feature = config.features[featureKey];
    if (feature && feature.envVars.length > 0) {
      featureGroups[feature.name] = feature.envVars;
    }
  }

  // 生成每个功能的环境变量
  for (const [featureName, vars] of Object.entries(featureGroups)) {
    content.push('# ========================================');
    content.push(`# ${featureName} Configuration`);
    content.push('# ========================================');
    
    for (const envVar of vars) {
      if (envVar.description) {
        content.push(`# ${envVar.description}`);
      }
      content.push(`${envVar.key}=${envVar.default}`);
      content.push('');
    }
  }

  const envPath = path.join(targetPath, 'apps/backend/.env.example');
  await fs.ensureDir(path.dirname(envPath));
  await fs.writeFile(envPath, content.join('\n'));
  logger.info('Generated .env.example');
}

/**
 * 复制配置文件
 */
export async function copyConfigFiles(
  features: string[],
  config: FeaturesConfig,
  templateDir: string,
  targetPath: string,
): Promise<void> {
  for (const featureKey of features) {
    const feature = config.features[featureKey];
    if (feature && feature.configFiles) {
      for (const configFile of feature.configFiles) {
        const sourcePath = path.join(templateDir, configFile.template);
        const destPath = path.join(targetPath, configFile.path);

        if (await fs.pathExists(sourcePath)) {
          await fs.ensureDir(path.dirname(destPath));
          await fs.copy(sourcePath, destPath);
          logger.info(`Copied config: ${configFile.path}`);
        } else {
          logger.warn(`Config template not found: ${sourcePath}`);
        }
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
  templateDir: string,
  targetPath: string,
): Promise<void> {
  for (const featureKey of features) {
    const feature = config.features[featureKey];
    if (feature && feature.exampleFiles) {
      const sourcePath = path.join(templateDir, feature.exampleFiles.source);
      const destPath = path.join(targetPath, feature.exampleFiles.target);

      if (await fs.pathExists(sourcePath)) {
        await fs.ensureDir(path.dirname(destPath));
        await fs.copy(sourcePath, destPath);
        logger.info(`Copied examples: ${feature.exampleFiles.target}`);
      } else {
        logger.warn(`Example template not found: ${sourcePath}`);
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
  templateDir: string,
  targetPath: string,
): Promise<void> {
  // 确保 .kiro/skills 目录存在
  const skillsDir = path.join(targetPath, '.kiro/skills');
  await fs.ensureDir(skillsDir);

  // 复制基础 skill
  const baseSkillSource = path.join(templateDir, 'skills/base.skill.md');
  const baseSkillDest = path.join(skillsDir, 'project-capabilities.md');
  if (await fs.pathExists(baseSkillSource)) {
    await fs.copy(baseSkillSource, baseSkillDest);
    logger.info('Copied base skill file');
  } else {
    logger.warn(`Base skill template not found: ${baseSkillSource}`);
  }

  // 复制功能 skill 文件
  for (const featureKey of features) {
    const feature = config.features[featureKey];
    if (feature && feature.skillFile) {
      const sourcePath = path.join(templateDir, feature.skillFile.template);
      const destPath = path.join(targetPath, feature.skillFile.target);

      if (await fs.pathExists(sourcePath)) {
        await fs.ensureDir(path.dirname(destPath));
        await fs.copy(sourcePath, destPath);
        logger.info(`Copied skill: ${feature.skillFile.target}`);
      } else {
        logger.warn(`Skill template not found: ${sourcePath}`);
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
2. 参考 \`apps/backend/src/examples/\` 目录下的示例代码
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
  const packageJsonPath = path.join(targetPath, 'apps/backend/package.json');
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
 * 生成模块集成说明文件
 * 不直接修改 app.module.ts，而是生成说明文档
 */
export async function updateAppModule(
  features: string[],
  config: FeaturesConfig,
  targetPath: string,
): Promise<void> {
  if (features.length === 0) {
    return;
  }

  // 生成导入语句
  const imports = generateModuleImports(features, config);
  
  // 生成模块注册代码
  const registrations = generateModuleRegistrations(features, config);

  // 生成集成说明文档
  const content = `# 功能模块集成说明

本文档说明如何将选中的功能模块集成到 app.module.ts 中。

## 1. 添加导入语句

在 \`apps/backend/src/app.module.ts\` 文件顶部添加以下导入：

\`\`\`typescript
${imports}
\`\`\`

## 2. 注册模块

在 \`@Module\` 装饰器的 \`imports\` 数组中添加以下模块：

\`\`\`typescript
@Module({
  imports: [
    // ... 其他模块
${registrations}
  ],
  // ...
})
export class AppModule {}
\`\`\`

## 3. 配置文件

每个功能的配置文件已生成在 \`apps/backend/src/config/\` 目录下：

${features.map((key) => {
  const feature = config.features[key];
  return `- **${feature.name}**: \`src/config/${key}.config.ts\``;
}).join('\n')}

## 4. 示例代码

示例代码已生成在 \`apps/backend/src/examples/\` 目录下，可以参考使用。

## 5. 环境变量

请复制 \`.env.example\` 为 \`.env\` 并填写相应的配置值。

## 6. 更多文档

查看 \`.kiro/skills/\` 目录下的详细文档了解每个功能的使用方法。
`;

  const docPath = path.join(targetPath, 'apps/backend/FEATURE_INTEGRATION.md');
  await fs.writeFile(docPath, content);
  logger.info('Generated feature integration guide: apps/backend/FEATURE_INTEGRATION.md');
}
