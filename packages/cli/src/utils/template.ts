import fs from 'fs-extra';
import path from 'path';
import { logger } from './logger';
import { copyTemplateFiles } from './copy-template';
import { generateDockerCompose } from './compose';
import { generateAppDockerfile, generateProdDockerCompose, generateDockerignore, AppDockerTarget } from './docker-gen';
import { version as cliVersion } from '../../package.json';

interface ProjectConfig {
  projectName: string;
  orgName: string;
  template: string;
  packageManager: string;
  installDeps: boolean;
  initGit: boolean;
  projectPath: string;
}

export async function generateFromTemplate(config: ProjectConfig): Promise<void> {
  // 创建根目录文件
  await createRootFiles(config);
  
  // 复制模板文件
  await copyTemplateFiles({
    projectName: config.projectName,
    orgName: config.orgName,
    template: config.template,
    projectPath: config.projectPath
  });

  // 写入 Docker 产物(在 apps/ 复制完成后,这样 apps/<app>/Dockerfile 能写入)
  await writeDockerArtifacts(config);
}

async function createRootFiles(config: ProjectConfig): Promise<void> {
  const { projectName, orgName, packageManager, template } = config;
  
  // package.json
  const packageJson = {
    name: projectName,
    version: '1.0.0',
    private: true,
    description: `Full-stack application based on Svton architecture`,
    scripts: {
      dev: 'turbo run dev',
      [`dev:backend`]: `turbo run dev --filter=${orgName}/backend`,
      [`dev:admin`]: `turbo run dev --filter=${orgName}/admin`,
      [`dev:mobile`]: `turbo run dev --filter=${orgName}/mobile`,
      build: 'turbo run build',
      lint: 'turbo run lint',
      'type-check': 'turbo run type-check',
      clean: 'turbo run clean && rm -rf node_modules'
    },
    devDependencies: {
      '@svton/cli': `^${cliVersion}`,
      turbo: '^1.11.0',
      typescript: '^5.3.0',
      '@types/node': '^20.10.0',
      prettier: '^3.1.0',
      eslint: '^8.55.0'
    },
    packageManager: `${packageManager}@8.12.0`,
    engines: {
      node: '>=18.0.0',
      pnpm: '>=8.0.0'
    },
    svton: {
      schema: 1
    }
  };

  await fs.writeJson('package.json', packageJson, { spaces: 2 });

  // pnpm-workspace.yaml
  const workspaceConfig = `packages:
  - 'apps/*'
  - 'packages/*'
`;
  await fs.writeFile('pnpm-workspace.yaml', workspaceConfig);

  // turbo.json
  const turboConfig = {
    "$schema": "https://turbo.build/schema.json",
    pipeline: {
      build: {
        dependsOn: ["^build"],
        outputs: ["dist/**", ".next/**", "build/**"]
      },
      dev: {
        cache: false,
        persistent: true
      },
      lint: {
        outputs: []
      },
      "type-check": {
        dependsOn: ["^build"],
        outputs: []
      },
      clean: {
        cache: false
      }
    }
  };

  await fs.writeJson('turbo.json', turboConfig, { spaces: 2 });

  // .gitignore
  const gitignore = `# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/
.next/
.turbo/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Testing
coverage/

# Misc
*.tsbuildinfo
`;

  await fs.writeFile('.gitignore', gitignore);

  // .npmrc
  const npmrc = `auto-install-peers=true
strict-peer-dependencies=false
`;
  await fs.writeFile('.npmrc', npmrc);

  // docker-compose.yml（与 `svton services init` 共用同一生成器）
  const dockerCompose = generateDockerCompose({ projectName });

  await fs.writeFile('docker-compose.yml', dockerCompose);

  // README.md
  const readme = await generateReadme(config);
  await fs.writeFile('README.md', readme);

  // svton.config.ts —— Svton 架构规范清单（新建项目即可被 `svton dev` 等命令识别）
  // apps 按所选模板生成，避免引用不存在的目录
  const hasBackend = template === 'full-stack' || template === 'backend-only';
  const hasAdmin = template === 'full-stack' || template === 'admin-only';
  const hasMobile = template === 'full-stack' || template === 'mobile-only';
  const appsLines: string[] = [];
  if (hasBackend) appsLines.push("    backend: { dir: 'apps/backend', type: 'nest', port: 3000 },");
  if (hasAdmin) appsLines.push("    admin: { dir: 'apps/admin', type: 'next', port: 3001 },");
  if (hasMobile) appsLines.push("    mobile: { dir: 'apps/mobile', type: 'taro' },");
  const databaseLine = hasBackend ? `\n  database: { orm: 'prisma', dir: 'apps/backend' },` : '';

  // svton.config.ts 用零依赖的纯对象(不 import @svton/cli),
  // 这样项目未 install 也能被 `svton` 加载,避免 MODULE_NOT_FOUND。
  // 想要类型提示可手动改为:import { defineSvtonProject } from '@svton/cli'
  const svtonConfig = `// Svton 项目清单。纯对象,无需安装 @svton/cli 即可被 svton 识别。
// 如需编辑器类型提示:pnpm add -D @svton/cli,再把下面改为 defineSvtonProject({...})。
export default {
  schema: 1,
  apps: {
${appsLines.join('\n')}
  },${databaseLine}
  services: { compose: 'docker-compose.yml' },
};
`;
  await fs.writeFile('svton.config.ts', svtonConfig);
}

/** 写入 Docker 产物(Dockerfile + 生产 compose + .dockerignore)。在 copyTemplateFiles 之后调用,确保 apps/<app>/ 已存在。 */
async function writeDockerArtifacts(config: ProjectConfig): Promise<void> {
  const { projectName, template } = config;
  const hasBackend = template === 'full-stack' || template === 'backend-only';
  const hasAdmin = template === 'full-stack' || template === 'admin-only';
  // 给可容器化的 app(nest/next)生成 Dockerfile;mobile(taro)是构建产物,不容器化。
  const dockerApps: AppDockerTarget[] = [];
  if (hasBackend) dockerApps.push({ name: 'backend', dir: 'apps/backend', type: 'nest', port: 3000 });
  if (hasAdmin) dockerApps.push({ name: 'admin', dir: 'apps/admin', type: 'next', port: 3001 });
  if (dockerApps.length === 0) return;
  for (const app of dockerApps) {
    await fs.writeFile(path.join(app.dir, 'Dockerfile'), generateAppDockerfile(app));
  }
  await fs.writeFile('docker-compose.prod.yml', generateProdDockerCompose({ projectName, apps: dockerApps }));
  await fs.writeFile('.dockerignore', generateDockerignore());
}

async function generateReadme(config: ProjectConfig): Promise<string> {
  const { projectName, orgName, template } = config;
  
  return `# ${projectName}

> Based on Svton architecture - Full-stack application

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker (for MySQL and Redis)

### Installation

\`\`\`bash
# Install dependencies
pnpm install

# Start databases
docker-compose up -d

# Configure environment variables
cp apps/backend/.env.example apps/backend/.env

# Generate Prisma client
pnpm --filter ${orgName}/backend prisma:generate

# Run database migrations
pnpm --filter ${orgName}/backend prisma:migrate

# Start development servers
pnpm dev
\`\`\`

### Services

| Service | URL |
|---------|-----|
| Backend API | http://localhost:3000 |
| Admin Panel | http://localhost:3001 |
| API Docs | http://localhost:3000/api-docs |

## 📁 Project Structure

\`\`\`
${projectName}/
├── apps/
${template === 'full-stack' || template === 'backend-only' ? '│   ├── backend/        # ' + orgName + '/backend - NestJS API' : ''}
${template === 'full-stack' || template === 'admin-only' ? '│   ├── admin/          # ' + orgName + '/admin - Next.js Admin Panel' : ''}
${template === 'full-stack' || template === 'mobile-only' ? '│   └── mobile/         # ' + orgName + '/mobile - Taro Mini Program' : ''}
├── packages/
│   └── types/          # ${orgName}/types - Shared Type Definitions
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── docker-compose.yml
\`\`\`

## 🛠️ Commands

\`\`\`bash
pnpm dev              # Start all services
pnpm dev:backend      # Start backend only
pnpm dev:admin        # Start admin panel only
pnpm dev:mobile       # Start mobile app only
pnpm build            # Build all projects
pnpm lint             # Run linting
pnpm clean            # Clean build artifacts
\`\`\`

## 📚 Documentation

- [Svton Architecture](https://github.com/svton/svton)

---

Generated with \`create-svton-app\`
`;
}

async function createBackendApp(config: ProjectConfig, templatesDir: string): Promise<void> {
  const backendDir = 'apps/backend';
  await fs.ensureDir(backendDir);
  
  // This would copy from templates and replace placeholders
  logger.debug('Creating backend application...');
  // Implementation would copy template files and replace variables
}

async function createAdminApp(config: ProjectConfig, templatesDir: string): Promise<void> {
  const adminDir = 'apps/admin';
  await fs.ensureDir(adminDir);
  
  logger.debug('Creating admin application...');
  // Implementation would copy template files and replace variables
}

async function createMobileApp(config: ProjectConfig, templatesDir: string): Promise<void> {
  const mobileDir = 'apps/mobile';
  await fs.ensureDir(mobileDir);
  
  logger.debug('Creating mobile application...');
  // Implementation would copy template files and replace variables
}

async function createTypesPackage(config: ProjectConfig, templatesDir: string): Promise<void> {
  const typesDir = 'packages/types';
  await fs.ensureDir(typesDir);
  
  logger.debug('Creating types package...');
  // Implementation would copy template files and replace variables
}
