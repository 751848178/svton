import fs from 'fs-extra';
import path from 'path';
import { logger } from './logger';
import { copyTemplateFiles } from './copy-template';

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
}

async function createRootFiles(config: ProjectConfig): Promise<void> {
  const { projectName, orgName, packageManager } = config;
  
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

  // docker-compose.yml
  const dockerCompose = `version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: ${projectName}-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root123456
      MYSQL_DATABASE: ${projectName}
      MYSQL_USER: ${projectName}
      MYSQL_PASSWORD: ${projectName}123456
    ports:
      - '3306:3306'
    volumes:
      - mysql_data:/var/lib/mysql
    command: --default-authentication-plugin=mysql_native_password

  redis:
    image: redis:7-alpine
    container_name: ${projectName}-redis
    restart: unless-stopped
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data

volumes:
  mysql_data:
  redis_data:
`;

  await fs.writeFile('docker-compose.yml', dockerCompose);

  // README.md
  const readme = await generateReadme(config);
  await fs.writeFile('README.md', readme);
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
