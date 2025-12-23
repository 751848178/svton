import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import validateNpmPackageName from 'validate-npm-package-name';
import { generateFromTemplate } from '../utils/template';
import { installDependencies } from '../utils/install';
import { initGit } from '../utils/git';
import { logger } from '../utils/logger';

export interface CreateOptions {
  org?: string;
  skipInstall?: boolean;
  skipGit?: boolean;
  template?: string;
  packageManager?: 'npm' | 'yarn' | 'pnpm';
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

    // 交互式配置
    const answers = await inquirer.prompt([
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

    const config = {
      projectName,
      orgName: answers.org.startsWith('@') ? answers.org : `@${answers.org}`,
      template: answers.template,
      packageManager: answers.packageManager,
      installDeps: answers.installDeps,
      initGit: answers.initGit,
      projectPath,
    };

    logger.info('');
    logger.info(chalk.cyan('📋 Project Configuration:'));
    logger.info(`  Project Name: ${chalk.white(config.projectName)}`);
    logger.info(`  Organization: ${chalk.white(config.orgName)}`);
    logger.info(`  Template: ${chalk.white(config.template)}`);
    logger.info(`  Package Manager: ${chalk.white(config.packageManager)}`);
    logger.info(`  Install Dependencies: ${chalk.white(config.installDeps ? 'Yes' : 'No')}`);
    logger.info(`  Initialize Git: ${chalk.white(config.initGit ? 'Yes' : 'No')}`);
    logger.info('');

    // 确认创建
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
  packageManager: string;
  installDeps: boolean;
  initGit: boolean;
  projectPath: string;
}

async function createProjectFromTemplate(config: ProjectConfig) {
  const spinner = ora('Creating project...').start();

  try {
    // 创建项目目录
    await fs.ensureDir(config.projectPath);
    process.chdir(config.projectPath);

    // 生成项目文件
    spinner.text = 'Generating project files...';
    await generateFromTemplate(config);

    // 安装依赖
    if (config.installDeps) {
      spinner.text = 'Installing dependencies...';
      await installDependencies(config.packageManager);
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
  }
}
