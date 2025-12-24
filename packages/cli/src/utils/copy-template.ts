import fs from 'fs-extra';
import path from 'path';
import { logger } from './logger';
import { downloadTemplateFromGitHub, cleanupTemplateDir } from './github-template';

interface TemplateConfig {
  projectName: string;
  orgName: string;
  template: string;
  projectPath: string;
}

export async function copyTemplateFiles(config: TemplateConfig): Promise<void> {
  const { template, projectPath } = config;
  
  let templateDir: string | null = null;
  let needCleanup = false;
  
  // 1. 优先尝试本地开发环境路径（monorepo 根目录的 templates）
  const cliPackageRoot = path.dirname(__dirname);
  const frameworkRoot = path.dirname(path.dirname(cliPackageRoot));
  const localTemplateDir = path.join(frameworkRoot, 'templates');
  
  if (await fs.pathExists(localTemplateDir)) {
    templateDir = localTemplateDir;
    logger.debug(`Using local template directory: ${templateDir}`);
  }
  
  // 2. 如果本地不存在，从 GitHub 下载
  if (!templateDir) {
    logger.info('Downloading templates from GitHub...');
    try {
      templateDir = await downloadTemplateFromGitHub();
      needCleanup = true;
      logger.info('Templates downloaded successfully');
    } catch (error) {
      logger.warn(`Failed to download templates from GitHub: ${error}`);
      logger.warn('Using built-in minimal templates');
      await copyBuiltInTemplates(config);
      return;
    }
  }
  
  logger.debug(`Copying template files from: ${templateDir}`);

  // 切换到目标项目目录
  const originalCwd = process.cwd();
  process.chdir(projectPath);

  try {
    // 根据模板类型复制对应的应用
    switch (template) {
      case 'full-stack':
        await copyBackendTemplate(templateDir, config);
        await copyAdminTemplate(templateDir, config);
        await copyMobileTemplate(templateDir, config);
        await copySharedPackages(templateDir, config);
        break;
      case 'backend-only':
        await copyBackendTemplate(templateDir, config);
        await copySharedPackages(templateDir, config);
        break;
      case 'admin-only':
        await copyAdminTemplate(templateDir, config);
        await copySharedPackages(templateDir, config);
        break;
      case 'mobile-only':
        await copyMobileTemplate(templateDir, config);
        await copySharedPackages(templateDir, config);
        break;
    }
  } finally {
    process.chdir(originalCwd);
    // 清理从 GitHub 下载的临时目录
    if (needCleanup && templateDir) {
      await cleanupTemplateDir(templateDir);
    }
  }
}

async function copyBackendTemplate(sourceDir: string, config: TemplateConfig): Promise<void> {
  const sourcePath = path.join(sourceDir, 'apps/backend');
  const destPath = 'apps/backend';
  
  await fs.ensureDir(destPath);
  await fs.copy(sourcePath, destPath, {
    filter: (src: string) => {
      const relativePath = path.relative(sourcePath, src);
      // 排除一些文件
      return !relativePath.includes('node_modules') && 
             !relativePath.includes('dist') &&
             !relativePath.includes('.env') &&
             !relativePath.includes('.env.local');
    }
  });

  // 替换包名
  await replacePackageNames(destPath, config);
  logger.debug('Backend template copied');
}

async function copyAdminTemplate(sourceDir: string, config: TemplateConfig): Promise<void> {
  const sourcePath = path.join(sourceDir, 'apps/admin');
  const destPath = 'apps/admin';
  
  await fs.ensureDir(destPath);
  await fs.copy(sourcePath, destPath, {
    filter: (src: string) => {
      const relativePath = path.relative(sourcePath, src);
      return !relativePath.includes('node_modules') && 
             !relativePath.includes('.next') &&
             !relativePath.includes('.env.local');
    }
  });

  await replacePackageNames(destPath, config);
  logger.debug('Admin template copied');
}

async function copyMobileTemplate(sourceDir: string, config: TemplateConfig): Promise<void> {
  const sourcePath = path.join(sourceDir, 'apps/mobile');
  const destPath = 'apps/mobile';
  
  await fs.ensureDir(destPath);
  await fs.copy(sourcePath, destPath, {
    filter: (src: string) => {
      const relativePath = path.relative(sourcePath, src);
      return !relativePath.includes('node_modules') && 
             !relativePath.includes('dist');
    }
  });

  await replacePackageNames(destPath, config);
  logger.debug('Mobile template copied');
}

async function copySharedPackages(sourceDir: string, config: TemplateConfig): Promise<void> {
  const packagesSourceDir = path.join(sourceDir, 'packages');
  const packagesDestDir = 'packages';
  
  await fs.ensureDir(packagesDestDir);
  
  // 复制 packages 目录下的所有包
  const packages = await fs.readdir(packagesSourceDir, { withFileTypes: true });
  
  for (const pkg of packages) {
    if (pkg.isDirectory()) {
      const sourcePath = path.join(packagesSourceDir, pkg.name);
      const destPath = path.join(packagesDestDir, pkg.name);
      
      await fs.ensureDir(destPath);
      await fs.copy(sourcePath, destPath, {
        filter: (src: string) => {
          const relativePath = path.relative(sourcePath, src);
          return !relativePath.includes('node_modules') && 
                 !relativePath.includes('dist');
        }
      });
      
      await replacePackageNames(destPath, config);
      logger.debug(`Package ${pkg.name} copied`);
    }
  }
}

async function replacePackageNames(directory: string, config: TemplateConfig): Promise<void> {
  const { projectName, orgName } = config;
  
  // 查找所有需要替换的文件
  const filesToUpdate = await findFilesToUpdate(directory);
  
  for (const filePath of filesToUpdate) {
    try {
      let content = await fs.readFile(filePath, 'utf8');
      
      // 替换模板占位符（不替换 @svton/ 公共包前缀）
      content = content
        .replace(/\{\{ORG_NAME\}\}/g, orgName)
        .replace(/\{\{PROJECT_NAME\}\}/g, projectName);
      
      // 如果是 .tpl 文件，重命名为实际文件
      if (filePath.endsWith('.tpl')) {
        const newPath = filePath.replace(/\.tpl$/, '');
        await fs.writeFile(newPath, content);
        await fs.remove(filePath);
      } else {
        await fs.writeFile(filePath, content);
      }
    } catch (error) {
      logger.debug(`Failed to update file ${filePath}: ${error}`);
    }
  }
}

async function findFilesToUpdate(directory: string): Promise<string[]> {
  const files: string[] = [];
  
  const traverse = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await traverse(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        const shouldUpdate = ['.json', '.ts', '.tsx', '.js', '.jsx', '.md', '.yaml', '.yml', '.env.example', '.tpl'].includes(ext) || entry.name.endsWith('.tpl');
        
        if (shouldUpdate) {
          files.push(fullPath);
        }
      }
    }
  };
  
  await traverse(directory);
  return files;
}

async function copyBuiltInTemplates(config: TemplateConfig): Promise<void> {
  // 如果没有找到原始模板，创建最小化的项目结构
  logger.info('Creating minimal project structure...');
  
  const { template } = config;
  
  if (template === 'full-stack' || template === 'backend-only') {
    await createMinimalBackend(config);
  }
  
  if (template === 'full-stack' || template === 'admin-only') {
    await createMinimalAdmin(config);
  }
  
  if (template === 'full-stack' || template === 'mobile-only') {
    await createMinimalMobile(config);
  }
  
  await createMinimalTypes(config);
}

async function createMinimalBackend(config: TemplateConfig): Promise<void> {
  const dir = 'apps/backend';
  await fs.ensureDir(dir);
  
  // 创建基础的 package.json
  const packageJson = {
    name: `${config.orgName}/backend`,
    version: '1.0.0',
    description: 'Backend API server',
    scripts: {
      build: 'nest build',
      dev: 'nest start --watch',
      start: 'node dist/main',
      lint: 'eslint "src/**/*.{ts,tsx}"',
      'type-check': 'tsc --noEmit'
    },
    dependencies: {
      '@nestjs/common': '^10.3.0',
      '@nestjs/core': '^10.3.0',
      '@nestjs/platform-express': '^10.3.0',
      'reflect-metadata': '^0.2.1',
      'rxjs': '^7.8.1'
    },
    devDependencies: {
      '@nestjs/cli': '^10.2.1',
      '@types/node': '^20.10.0',
      'typescript': '^5.3.0'
    }
  };
  
  await fs.writeJson(path.join(dir, 'package.json'), packageJson, { spaces: 2 });
}

async function createMinimalAdmin(config: TemplateConfig): Promise<void> {
  const dir = 'apps/admin';
  await fs.ensureDir(dir);
  
  const packageJson = {
    name: `${config.orgName}/admin`,
    version: '1.0.0',
    description: 'Admin panel',
    scripts: {
      dev: 'next dev -p 3001',
      build: 'next build',
      start: 'next start -p 3001',
      lint: 'next lint',
      'type-check': 'tsc --noEmit'
    },
    dependencies: {
      'next': '^15.5.0',
      'react': '^19.0.0',
      'react-dom': '^19.0.0'
    },
    devDependencies: {
      '@types/node': '^22.10.2',
      '@types/react': '^19.0.2',
      '@types/react-dom': '^19.0.2',
      'typescript': '^5.7.3'
    }
  };
  
  await fs.writeJson(path.join(dir, 'package.json'), packageJson, { spaces: 2 });
}

async function createMinimalMobile(config: TemplateConfig): Promise<void> {
  const dir = 'apps/mobile';
  await fs.ensureDir(dir);
  
  const packageJson = {
    name: `${config.orgName}/mobile`,
    version: '1.0.0',
    description: 'Mobile application',
    scripts: {
      'build:weapp': 'taro build --type weapp',
      'dev:weapp': 'taro build --type weapp --watch',
      dev: 'npm run dev:weapp',
      lint: 'eslint "src/**/*.{ts,tsx}"',
      'type-check': 'tsc --noEmit'
    },
    dependencies: {
      '@tarojs/components': '3.6.23',
      '@tarojs/runtime': '3.6.23',
      '@tarojs/taro': '3.6.23',
      '@tarojs/react': '3.6.23',
      'react': '^18.2.0'
    },
    devDependencies: {
      '@tarojs/cli': '3.6.23',
      '@types/react': '^18.2.45',
      'typescript': '^5.3.3'
    }
  };
  
  await fs.writeJson(path.join(dir, 'package.json'), packageJson, { spaces: 2 });
}

async function createMinimalTypes(config: TemplateConfig): Promise<void> {
  const dir = 'packages/types';
  await fs.ensureDir(dir);
  
  const packageJson = {
    name: `@${config.orgName}/types`,
    version: '1.0.0',
    description: 'Shared type definitions',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    scripts: {
      build: 'tsup src/index.ts --format cjs,esm --dts',
      dev: 'tsup src/index.ts --format cjs,esm --dts --watch',
      'type-check': 'tsc --noEmit'
    },
    devDependencies: {
      'tsup': '^8.0.1',
      'typescript': '^5.3.3'
    }
  };
  
  await fs.writeJson(path.join(dir, 'package.json'), packageJson, { spaces: 2 });
}
