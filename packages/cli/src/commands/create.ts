import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import validateNpmPackageName from 'validate-npm-package-name';
import { generateFromTemplate } from '../utils/template';
import { installDependencies } from '../utils/install';
import { initGit } from '../utils/git';
import { logger } from '../utils/logger';
import { resolveNpmRegistry } from '../utils/registry';
import { cleanupResolvedTemplateDir, resolveTemplateDir, ResolvedTemplateDir } from '../utils/template-source';
import {
  loadFeaturesConfig,
  getFeatureChoices,
  generateEnvExample,
  copyConfigFiles,
  copyExampleFiles,
  copySkillFiles,
  copyPrismaTemplates,
  updatePackageJson,
  updateAppModule,
} from '../utils/features';

export interface CreateOptions {
  org?: string;
  skipInstall?: boolean;
  skipGit?: boolean;
  template?: string;
  packageManager?: 'npm' | 'yarn' | 'pnpm';
  registry?: string;
  yes?: boolean;
}

export async function createProject(projectName: string, options: CreateOptions = {}) {
  try {
    // 验证项目名称
    const validation = validateNpmPackageName(projectName);
    if (!validation.validForNewPackages) {
      logger.error(`Invalid project name: ${projectName}`);
      if (validation.errors) {
        validation.errors.forEach(error => logger.error(`- ${error}`));
      }
      process.exit(1);
    }

    // 检查目录是否已存在
    const projectPath = path.resolve(process.cwd(), projectName);
    if (await fs.pathExists(projectPath)) {
      logger.error(`Directory ${projectName} already exists!`);
      process.exit(1);
    }

    logger.info(chalk.blue('🚀 Welcome to Svton App Generator!'));
    logger.info('');

    // 加载功能配置
    const featuresConfig = await loadFeaturesConfig();

    // 交互式配置或使用默认值
    let answers;
    if (options.yes) {
      // 非交互式模式，使用默认值或命令行参数
      answers = {
        org: options.org || projectName,
        template: options.template || 'full-stack',
        database: 'mysql', // 默认使用 MySQL
        features: [], // 默认不选择额外功能
        packageManager: options.packageManager || 'pnpm',
        registry: options.registry,
        installDeps: !options.skipInstall,
        initGit: !options.skipGit,
      };
    } else {
      // 交互式模式
      answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'org',
          message: 'Organization name (will be used as @org/package-name):',
          default: options.org || projectName,
          validate: (input: string) => {
            if (!input.trim()) return 'Organization name is required';
            return true;
          },
        },
        {
          type: 'list',
          name: 'template',
          message: 'Choose a template:',
          choices: [
            { name: 'Full Stack (Backend + Admin + Mobile)', value: 'full-stack' },
            { name: 'Backend Only (NestJS + Prisma)', value: 'backend-only' },
            { name: 'Admin Only (Next.js)', value: 'admin-only' },
            { name: 'Mobile Only (Taro)', value: 'mobile-only' },
          ],
          default: options.template || 'full-stack',
        },
        {
          type: 'list',
          name: 'database',
          message: 'Choose a database:',
          choices: [
            { name: 'MySQL', value: 'mysql' },
            { name: 'PostgreSQL', value: 'postgresql' },
            { name: 'SQLite', value: 'sqlite' },
          ],
          default: 'mysql',
          when: (answers) => answers.template === 'backend-only' || answers.template === 'full-stack',
        },
        {
          type: 'checkbox',
          name: 'features',
          message: 'Select features to include (use space to select, enter to confirm):',
          choices: getFeatureChoices(featuresConfig),
          when: (answers) => answers.template === 'backend-only' || answers.template === 'full-stack',
        },
        {
          type: 'list',
          name: 'packageManager',
          message: 'Package manager:',
          choices: ['pnpm', 'npm', 'yarn'],
          default: options.packageManager || 'pnpm',
        },
        {
          type: 'confirm',
          name: 'installDeps',
          message: 'Install dependencies?',
          default: !options.skipInstall,
        },
        {
          type: 'confirm',
          name: 'initGit',
          message: 'Initialize Git repository?',
          default: !options.skipGit,
        },
      ]);
    }

    const config = {
      projectName,
      orgName: answers.org.startsWith('@') ? answers.org : `@${answers.org}`,
      template: answers.template,
      database: answers.database || 'mysql',
      features: answers.features || [],
      packageManager: answers.packageManager,
      registry: resolveNpmRegistry(options.registry || answers.registry),
      installDeps: answers.installDeps,
      initGit: answers.initGit,
      projectPath,
    };

    logger.info('');
    logger.info(chalk.cyan('📋 Project Configuration:'));
    logger.info(`  Project Name: ${chalk.white(config.projectName)}`);
    logger.info(`  Organization: ${chalk.white(config.orgName)}`);
    logger.info(`  Template: ${chalk.white(config.template)}`);
    if (config.template === 'backend-only' || config.template === 'full-stack') {
      logger.info(`  Database: ${chalk.white(config.database)}`);
    }
    if (config.features.length > 0) {
      logger.info(`  Features: ${chalk.white(config.features.join(', '))}`);
    }
    logger.info(`  Package Manager: ${chalk.white(config.packageManager)}`);
    logger.info(`  NPM Registry: ${chalk.white(config.registry)}`);
    logger.info(`  Install Dependencies: ${chalk.white(config.installDeps ? 'Yes' : 'No')}`);
    logger.info(`  Initialize Git: ${chalk.white(config.initGit ? 'Yes' : 'No')}`);
    logger.info('');

    // 确认创建
    if (!options.yes) {
      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Proceed with project creation?',
          default: true,
        },
      ]);

      if (!proceed) {
        logger.info(chalk.yellow('Project creation cancelled.'));
        return;
      }
    }

    // 创建项目
    await createProjectFromTemplate(config);

    // 成功提示
    logger.info('');
    logger.success(chalk.green('🎉 Project created successfully!'));
    logger.info('');
    logger.info(chalk.cyan('Next steps:'));
    logger.info(`  ${chalk.gray('$')} cd ${projectName}`);
    
    if (!config.installDeps) {
      logger.info(`  ${chalk.gray('$')} ${config.packageManager} install`);
    }
    
    if (config.template === 'full-stack' || config.template === 'backend-only') {
      logger.info(`  ${chalk.gray('$')} docker-compose up -d`);
      logger.info(`  ${chalk.gray('$')} ${config.packageManager} --filter ${config.orgName}/backend prisma:generate`);
      logger.info(`  ${chalk.gray('$')} ${config.packageManager} --filter ${config.orgName}/backend prisma:migrate`);
    }
    
    logger.info(`  ${chalk.gray('$')} ${config.packageManager} dev`);
    logger.info('');
    logger.info(chalk.gray('Happy coding! 🚀'));

  } catch (error) {
    logger.error('Failed to create project:');
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

interface ProjectConfig {
  projectName: string;
  orgName: string;
  template: string;
  database: string;
  features: string[];
  packageManager: string;
  registry: string;
  installDeps: boolean;
  initGit: boolean;
  projectPath: string;
}

async function createProjectFromTemplate(config: ProjectConfig) {
  const spinner = ora('Creating project...').start();
  let templateDirToCleanup: ResolvedTemplateDir | null = null;

  try {
    // 创建项目目录
    await fs.ensureDir(config.projectPath);
    process.chdir(config.projectPath);

    // 生成项目文件
    spinner.text = 'Generating project files...';
    await generateFromTemplate(config);

    // 如果选择了功能，集成功能
    if (config.features.length > 0) {
      spinner.text = 'Integrating selected features...';
      const featuresConfig = await loadFeaturesConfig();
      
      // 获取 template 目录（与 copy-template.ts 逻辑一致）
      const resolvedTemplate = await resolveTemplateDir();
      const templateDir = resolvedTemplate.templateDir;
      templateDirToCleanup = resolvedTemplate.cleanup ? resolvedTemplate : null;

      // 更新 package.json
      await updatePackageJson(config.features, featuresConfig, config.projectPath);

      // 复制配置文件
      await copyConfigFiles(config.features, featuresConfig, templateDir, config.projectPath);

      // 复制示例代码
      await copyExampleFiles(config.features, featuresConfig, templateDir, config.projectPath);

      // 复制 Skill 文件
      await copySkillFiles(config.features, featuresConfig, templateDir, config.projectPath);

      // 复制 Prisma 模板（如果是后端项目）
      if (config.template === 'backend-only' || config.template === 'full-stack') {
        await copyPrismaTemplates(templateDir, config.projectPath, config.database);
      }

      // 生成 .env.example
      await generateEnvExample(config.features, featuresConfig, config.projectPath, config.database);

      // 更新 app.module.ts（如果是后端项目）
      if (config.template === 'backend-only' || config.template === 'full-stack') {
        await updateAppModule(config.features, featuresConfig, config.projectPath);
      }
    }

    // 安装依赖
    if (config.installDeps) {
      spinner.text = 'Installing dependencies...';
      await installDependencies(config.packageManager, { registry: config.registry });
      
      // 如果是后端项目，运行 prisma generate
      if (config.template === 'backend-only' || config.template === 'full-stack') {
        spinner.text = 'Generating Prisma client...';
        try {
          const { execSync } = require('child_process');
          execSync(`${config.packageManager} --filter=backend prisma:generate`, {
            cwd: config.projectPath,
            stdio: 'inherit',
          });
          logger.info('Prisma client generated successfully');
        } catch (error) {
          logger.warn('Failed to generate Prisma client. Please run "pnpm --filter=backend prisma:generate" manually.');
        }
      }
    }

    // 初始化 Git
    if (config.initGit) {
      spinner.text = 'Initializing Git repository...';
      await initGit(config.projectName);
    }

    spinner.succeed('Project created successfully!');
  } catch (error) {
    spinner.fail('Failed to create project');
    throw error;
  } finally {
    // 清理从 GitHub 下载的临时目录
    await cleanupResolvedTemplateDir(templateDirToCleanup);
  }
}
