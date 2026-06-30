import { GoneException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as archiver from 'archiver';
import { createHash } from 'crypto';
import { mkdir, readdir, rm, stat, writeFile } from 'fs/promises';
import * as path from 'path';
import { Writable } from 'stream';
import { RegistryService } from '../registry/registry.service';
import { ResourceService } from '../resource/resource.service';
import { ResourcePoolService } from '../resource-pool/resource-pool.service';
import { ResourceRequestService } from '../resource-request/resource-request.service';
import { GenerateProjectDto } from './dto/generate.dto';

export interface GeneratedFile {
  path: string;
  content: string;
  source?: string; // 标记文件来源（哪个功能生成的）
}

export interface ResourceCredential {
  type: string;
  config: Record<string, unknown>;
  mode?: ProjectResourceConfig['mode'];
  sourceId?: string;
  name?: string;
}

export interface ResourceResolutionSummary {
  type: string;
  mode: ProjectResourceConfig['mode'];
  sourceId?: string;
  name?: string;
  resourceName?: string;
}

export interface ResourceResolutionResult {
  credentials: ResourceCredential[];
  summary: ResourceResolutionSummary[];
}

export interface ProjectZipArtifact {
  kind: 'project_zip';
  storage: 'local';
  fileName: string;
  size: number;
  sha256: string;
  generatedAt: string;
  downloadUrl: string;
  retentionDays: number;
  expiresAt: string;
  lastDownloadedAt?: string;
  lastDownloadedBy?: string;
  downloadCount?: number;
}

export interface ResolvedProjectZipArtifact extends ProjectZipArtifact {
  filePath: string;
}

export interface ProjectZipArtifactCleanupResult {
  dryRun: boolean;
  scanned: number;
  expired: number;
  deleted: number;
  artifacts: Array<{
    filePath: string;
    fileName: string;
    size: number;
    generatedAt: string;
    expiresAt: string;
    deleted: boolean;
  }>;
}

interface ProjectResourceConfig {
  type?: string;
  mode?: 'manual' | 'credential' | 'instance' | 'pool' | 'skipped';
  config?: Record<string, unknown>;
  credentialId?: string;
  instanceId?: string;
  poolId?: string;
  resourceName?: string;
}

type DatabaseEngine = 'mysql' | 'postgresql' | 'sqlite';

interface DatabaseSettings {
  engine: DatabaseEngine;
  label: string;
  prismaProvider: string;
  defaultUrl: string;
}

const DEFAULT_DATABASE_ENGINE: DatabaseEngine = 'mysql';
const DEFAULT_ARTIFACT_ROOT = path.join(process.cwd(), 'storage', 'generated-projects');
const DEFAULT_ARTIFACT_RETENTION_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const DATABASE_ENGINE_ALIASES: Record<string, DatabaseEngine> = {
  mysql: 'mysql',
  postgresql: 'postgresql',
  postgres: 'postgresql',
  sqlite: 'sqlite',
};

const DATABASE_SETTINGS: Record<DatabaseEngine, DatabaseSettings> = {
  mysql: {
    engine: 'mysql',
    label: 'MySQL',
    prismaProvider: 'mysql',
    defaultUrl: 'mysql://root:password@localhost:3306/mydb',
  },
  postgresql: {
    engine: 'postgresql',
    label: 'PostgreSQL',
    prismaProvider: 'postgresql',
    defaultUrl: 'postgresql://postgres:postgres@localhost:5432/mydb?schema=public',
  },
  sqlite: {
    engine: 'sqlite',
    label: 'SQLite',
    prismaProvider: 'sqlite',
    defaultUrl: 'file:./dev.db',
  },
};

@Injectable()
export class GeneratorService {
  private readonly logger = new Logger(GeneratorService.name);

  constructor(
    private readonly registryService: RegistryService,
    private readonly resourceService: ResourceService,
    private readonly resourceRequestService: ResourceRequestService,
    private readonly resourcePoolService: ResourcePoolService,
  ) {}

  async generateProject(config: GenerateProjectDto, resourceCredentials?: ResourceCredential[]): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const { basicInfo, subProjects, features } = config;

    // 解析所有需要的包
    const allPackages = this.resolveAllPackages(config);

    // 生成根目录文件
    files.push(...this.generateRootFiles(config, allPackages));

    // 生成 Git 初始化文件
    files.push(...this.generateGitFiles(config));

    // 生成子项目
    if (subProjects.backend) {
      files.push(...this.generateBackendProject(config, allPackages));
    }

    if (subProjects.admin) {
      files.push(...this.generateAdminProject(config, allPackages));
    }

    if (subProjects.mobile) {
      files.push(...this.generateMobileProject(config, allPackages));
    }

    // 生成环境变量文件
    files.push(...this.generateEnvFiles(
      config,
      resourceCredentials ?? this.resolveResourceCredentials(config),
    ));

    // 生成 Docker Compose
    files.push(this.generateDockerCompose(config));

    this.logger.log(`Generated ${files.length} files for project: ${basicInfo.name}`);

    return files;
  }

  async resolveProjectResources(
    teamId: string,
    userId: string,
    projectId: string,
    config: GenerateProjectDto,
  ): Promise<ResourceResolutionResult> {
    const resources = config.resources || {};
    const credentials: ResourceCredential[] = [];
    const summary: ResourceResolutionSummary[] = [];

    for (const [resourceType, resource] of Object.entries(resources)) {
      if (!resource || typeof resource !== 'object') {
        continue;
      }

      const value = resource as ProjectResourceConfig;
      const type = value.type || resourceType;

      if (value.mode === 'skipped') {
        summary.push({ type, mode: 'skipped' });
        continue;
      }

      if (value.mode === 'credential' && value.credentialId) {
        const credential = await this.resourceService.getCredentialForGeneration(teamId, value.credentialId);
        credentials.push({
          type: credential.type,
          config: credential.config,
          mode: 'credential',
          sourceId: credential.id,
          name: credential.name,
        });
        summary.push({
          type: credential.type,
          mode: 'credential',
          sourceId: credential.id,
          name: credential.name,
        });
        continue;
      }

      if (value.mode === 'instance' && value.instanceId) {
        const instance = await this.resourceRequestService.getInstanceCredentialForGeneration(
          teamId,
          value.instanceId,
        );
        credentials.push({
          type: instance.type,
          config: instance.config,
          mode: 'instance',
          sourceId: instance.id,
          name: instance.name,
        });
        summary.push({
          type: instance.type,
          mode: 'instance',
          sourceId: instance.id,
          name: instance.name,
        });
        continue;
      }

      if (value.mode === 'pool' && value.poolId) {
        const allocation = await this.resourcePoolService.allocateResource(
          {
            poolId: value.poolId,
            projectId,
            resourceName: value.resourceName,
          },
          userId,
          teamId,
        );
        credentials.push({
          type: allocation.type || type,
          config: allocation.credentials,
          mode: 'pool',
          sourceId: allocation.id,
          name: allocation.resourceName,
        });
        summary.push({
          type: allocation.type || type,
          mode: 'pool',
          sourceId: allocation.id,
          name: allocation.resourceName,
          resourceName: allocation.resourceName,
        });
        continue;
      }

      if (value.mode === 'manual' && value.config) {
        credentials.push({
          type,
          config: value.config,
          mode: 'manual',
        });
        summary.push({ type, mode: 'manual' });
      }
    }

    return { credentials, summary };
  }

  private resolveAllPackages(config: GenerateProjectDto): Set<string> {
    const packages = new Set<string>();
    const { subProjects, features, uiLibrary, hooks } = config;

    // 基础包
    if (subProjects.backend) {
      packages.add('@svton/nestjs-logger');
      packages.add('@svton/nestjs-config-schema');
      packages.add('@svton/nestjs-http');
    }

    // UI 库
    if (uiLibrary.admin && subProjects.admin) {
      packages.add('@svton/ui');
    }
    if (uiLibrary.mobile && subProjects.mobile) {
      packages.add('@svton/taro-ui');
    }

    // Hooks
    if (hooks) {
      packages.add('@svton/hooks');
    }

    // 功能相关包
    const featurePackages = this.registryService.resolvePackages(features);
    featurePackages.forEach(pkg => packages.add(pkg));

    return packages;
  }

  private generateRootFiles(config: GenerateProjectDto, packages: Set<string>): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const { basicInfo } = config;

    // package.json
    files.push({
      path: 'package.json',
      content: JSON.stringify({
        name: basicInfo.name,
        version: '0.1.0',
        private: true,
        scripts: {
          dev: 'turbo run dev',
          build: 'turbo run build',
          lint: 'turbo run lint',
          'type-check': 'turbo run type-check',
        },
        devDependencies: {
          turbo: '^2.0.0',
        },
        packageManager: `${basicInfo.packageManager}@latest`,
      }, null, 2),
      source: 'core',
    });

    // pnpm-workspace.yaml
    if (basicInfo.packageManager === 'pnpm') {
      files.push({
        path: 'pnpm-workspace.yaml',
        content: `packages:\n  - "apps/*"\n  - "packages/*"\n`,
        source: 'core',
      });
    }

    // turbo.json
    files.push({
      path: 'turbo.json',
      content: JSON.stringify({
        $schema: 'https://turbo.build/schema.json',
        tasks: {
          build: {
            dependsOn: ['^build'],
            outputs: ['dist/**', '.next/**'],
          },
          dev: {
            cache: false,
            persistent: true,
          },
          lint: {},
          'type-check': {},
        },
      }, null, 2),
      source: 'core',
    });

    return files;
  }

  // 生成 Git 初始化文件 (Task 15.5)
  private generateGitFiles(config: GenerateProjectDto): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const { basicInfo } = config;
    const database = this.resolveDatabaseSettings(config);

    // .gitignore
    files.push({
      path: '.gitignore',
      content: `# Dependencies
node_modules
.pnpm-store

# Build outputs
dist
.next
.turbo
out

# Environment files
.env
.env.local
.env.*.local

# IDE
.idea
.vscode
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
pnpm-debug.log*

# Testing
coverage
.nyc_output

# Misc
*.tgz
.cache
`,
      source: 'git',
    });

    // README.md
    const subProjectsList = [];
    subProjectsList.push('- `apps/backend` - NestJS 后端服务');
    subProjectsList.push('- `apps/admin` - Next.js 管理后台');
    subProjectsList.push('- `apps/mobile` - Taro 小程序/H5');

    files.push({
      path: 'README.md',
      content: `# ${basicInfo.name}

${basicInfo.description || '基于 svton 技术栈的全栈项目'}

## 项目结构

\`\`\`
${basicInfo.name}/
├── apps/
│   ├── backend/     # NestJS 后端
│   ├── admin/       # Next.js 管理后台
│   └── mobile/      # Taro 小程序
├── packages/        # 共享包
├── docker-compose.yml
└── turbo.json
\`\`\`

## 快速开始

### 环境要求

- Node.js >= 18
- ${basicInfo.packageManager}
- Docker (可选，用于本地数据库)

### 安装依赖

\`\`\`bash
${basicInfo.packageManager} install
\`\`\`

### 启动开发服务

\`\`\`bash
# 启动所有服务
${basicInfo.packageManager} run dev

# 或单独启动
${basicInfo.packageManager} run dev --filter=backend
${basicInfo.packageManager} run dev --filter=admin
\`\`\`

### 使用 Docker 启动依赖服务

\`\`\`bash
docker-compose up -d
\`\`\`

## 环境变量

复制 \`.env.example\` 为 \`.env\` 并填写配置：

\`\`\`bash
cp .env.example .env
\`\`\`

## 构建

\`\`\`bash
${basicInfo.packageManager} run build
\`\`\`

## 技术栈

- **后端**: NestJS + Prisma + ${database.label}
- **前端**: Next.js 15 + React 19 + TailwindCSS
- **小程序**: Taro 3 + React
- **工具链**: Turborepo + pnpm

## License

MIT
`,
      source: 'git',
    });

    return files;
  }

  private generateBackendProject(config: GenerateProjectDto, packages: Set<string>): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const { basicInfo, features } = config;
    const database = this.resolveDatabaseSettings(config);

    // 获取后端相关的包
    const backendPackages: Record<string, string> = {
      '@nestjs/common': '^10.3.0',
      '@nestjs/core': '^10.3.0',
      '@nestjs/platform-express': '^10.3.0',
      '@nestjs/config': '^3.1.0',
      '@prisma/client': '^5.7.0',
      'reflect-metadata': '^0.2.0',
      rxjs: '^7.8.1',
    };

    // 添加 svton 包（使用增强的解析）
    const resolvedPackages = this.registryService.resolvePackagesWithDependencies(features);
    Object.assign(backendPackages, resolvedPackages.dependencies);

    // 添加基础 svton 包
    packages.forEach(pkg => {
      if (pkg.startsWith('@svton/nestjs-') && !backendPackages[pkg]) {
        backendPackages[pkg] = 'workspace:*';
      }
    });

    // package.json
    files.push({
      path: 'apps/backend/package.json',
      content: JSON.stringify({
        name: `@${basicInfo.orgName || basicInfo.name}/backend`,
        version: '0.1.0',
        private: true,
        scripts: {
          dev: 'nest start --watch',
          build: 'nest build',
          start: 'node dist/main',
          lint: 'eslint "{src,apps,libs,test}/**/*.ts"',
          'type-check': 'tsc --noEmit',
          'prisma:generate': 'prisma generate',
          'prisma:migrate': 'prisma migrate dev',
        },
        dependencies: backendPackages,
        devDependencies: {
          '@nestjs/cli': '^10.2.0',
          '@types/node': '^20.10.0',
          prisma: '^5.7.0',
          typescript: '^5.3.0',
        },
      }, null, 2),
      source: 'backend',
    });

    // tsconfig.json
    files.push({
      path: 'apps/backend/tsconfig.json',
      content: JSON.stringify({
        compilerOptions: {
          module: 'commonjs',
          declaration: true,
          removeComments: true,
          emitDecoratorMetadata: true,
          experimentalDecorators: true,
          allowSyntheticDefaultImports: true,
          target: 'ES2021',
          sourceMap: true,
          outDir: './dist',
          baseUrl: './',
          incremental: true,
          skipLibCheck: true,
          strictNullChecks: true,
          noImplicitAny: true,
          strictBindCallApply: true,
          forceConsistentCasingInFileNames: true,
          noFallthroughCasesInSwitch: true,
        },
      }, null, 2),
      source: 'backend',
    });

    // nest-cli.json
    files.push({
      path: 'apps/backend/nest-cli.json',
      content: JSON.stringify({
        $schema: 'https://json.schemastore.org/nest-cli',
        collection: '@nestjs/schematics',
        sourceRoot: 'src',
      }, null, 2),
      source: 'backend',
    });

    // main.ts
    files.push({
      path: 'apps/backend/src/main.ts',
      content: `import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));
  
  app.enableCors();
  app.setGlobalPrefix('api');
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(\`🚀 Server running on http://localhost:\${port}\`);
}

bootstrap();
`,
      source: 'backend',
    });

    // app.module.ts
    const moduleImports = this.registryService.getModuleImports(features);
    files.push({
      path: 'apps/backend/src/app.module.ts',
      content: `import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from '@svton/nestjs-logger';
${moduleImports.imports.join('\n')}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    
    // 日志模块
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        appName: '${basicInfo.name}-backend',
        env: config.get('NODE_ENV', 'development'),
        level: config.get('LOG_LEVEL', 'debug'),
      }),
    }),
    
    // 功能模块
${moduleImports.modules.join('\n')}
  ],
})
export class AppModule {}
`,
      source: 'backend',
    });

    // Prisma schema
    files.push({
      path: 'apps/backend/prisma/schema.prisma',
      content: `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${database.prismaProvider}"
  url      = env("DATABASE_URL")
}

// Add your models here
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`,
      source: 'backend',
    });

    return files;
  }

  private generateAdminProject(config: GenerateProjectDto, packages: Set<string>): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const { basicInfo, uiLibrary, hooks } = config;

    const dependencies: Record<string, string> = {
      next: '^15.0.0',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
    };

    if (uiLibrary.admin) {
      dependencies['@svton/ui'] = 'workspace:*';
    }
    if (hooks) {
      dependencies['@svton/hooks'] = 'workspace:*';
      dependencies['@svton/service'] = 'workspace:*';
    }

    files.push({
      path: 'apps/admin/package.json',
      content: JSON.stringify({
        name: `@${basicInfo.orgName || basicInfo.name}/admin`,
        version: '0.1.0',
        private: true,
        scripts: {
          dev: 'next dev -p 3001',
          build: 'next build',
          start: 'next start -p 3001',
          lint: 'next lint',
        },
        dependencies,
        devDependencies: {
          '@types/node': '^20.10.0',
          '@types/react': '^19.0.0',
          typescript: '^5.3.0',
          tailwindcss: '^3.4.0',
          autoprefixer: '^10.4.16',
          postcss: '^8.4.32',
        },
      }, null, 2),
      source: 'admin',
    });

    // next.config.js
    files.push({
      path: 'apps/admin/next.config.js',
      content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@svton/ui', '@svton/hooks', '@svton/service'],
};

module.exports = nextConfig;
`,
      source: 'admin',
    });

    // tailwind.config.js
    files.push({
      path: 'apps/admin/tailwind.config.js',
      content: `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`,
      source: 'admin',
    });

    // postcss.config.js
    files.push({
      path: 'apps/admin/postcss.config.js',
      content: `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
      source: 'admin',
    });

    // tsconfig.json
    files.push({
      path: 'apps/admin/tsconfig.json',
      content: JSON.stringify({
        compilerOptions: {
          target: 'ES2017',
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          plugins: [{ name: 'next' }],
          paths: { '@/*': ['./src/*'] },
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules'],
      }, null, 2),
      source: 'admin',
    });

    files.push({
      path: 'apps/admin/src/app/layout.tsx',
      content: `import './globals.css';

export const metadata = {
  title: '${basicInfo.name} Admin',
  description: '管理后台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
`,
      source: 'admin',
    });

    files.push({
      path: 'apps/admin/src/app/globals.css',
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;
`,
      source: 'admin',
    });

    files.push({
      path: 'apps/admin/src/app/page.tsx',
      content: `export default function HomePage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">${basicInfo.name} Admin Dashboard</h1>
      <p className="mt-4 text-gray-600">欢迎使用管理后台</p>
    </main>
  );
}
`,
      source: 'admin',
    });

    return files;
  }

  private generateMobileProject(config: GenerateProjectDto, packages: Set<string>): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const { basicInfo, uiLibrary, hooks } = config;

    const dependencies: Record<string, string> = {
      '@tarojs/taro': '^3.6.0',
      '@tarojs/components': '^3.6.0',
      '@tarojs/runtime': '^3.6.0',
      react: '^18.2.0',
      'react-dom': '^18.2.0',
    };

    if (uiLibrary.mobile) {
      dependencies['@svton/taro-ui'] = 'workspace:*';
    }
    if (hooks) {
      dependencies['@svton/hooks'] = 'workspace:*';
      dependencies['@svton/service'] = 'workspace:*';
    }

    files.push({
      path: 'apps/mobile/package.json',
      content: JSON.stringify({
        name: `@${basicInfo.orgName || basicInfo.name}/mobile`,
        version: '0.1.0',
        private: true,
        scripts: {
          'dev:weapp': 'taro build --type weapp --watch',
          'build:weapp': 'taro build --type weapp',
          'dev:h5': 'taro build --type h5 --watch',
          'build:h5': 'taro build --type h5',
        },
        dependencies,
        devDependencies: {
          '@tarojs/cli': '^3.6.0',
          '@types/react': '^18.2.0',
          typescript: '^5.3.0',
        },
      }, null, 2),
      source: 'mobile',
    });

    // app.config.ts
    files.push({
      path: 'apps/mobile/src/app.config.ts',
      content: `export default defineAppConfig({
  pages: ['pages/index/index'],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '${basicInfo.name}',
    navigationBarTextStyle: 'black',
  },
});
`,
      source: 'mobile',
    });

    files.push({
      path: 'apps/mobile/src/app.tsx',
      content: `import { PropsWithChildren } from 'react';
import './app.scss';

function App({ children }: PropsWithChildren) {
  return children;
}

export default App;
`,
      source: 'mobile',
    });

    files.push({
      path: 'apps/mobile/src/app.scss',
      content: `// 全局样式
`,
      source: 'mobile',
    });

    files.push({
      path: 'apps/mobile/src/pages/index/index.tsx',
      content: `import { View, Text } from '@tarojs/components';
import './index.scss';

export default function Index() {
  return (
    <View className="index">
      <Text className="title">${basicInfo.name}</Text>
      <Text className="desc">欢迎使用</Text>
    </View>
  );
}
`,
      source: 'mobile',
    });

    files.push({
      path: 'apps/mobile/src/pages/index/index.scss',
      content: `.index {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  
  .title {
    font-size: 24px;
    font-weight: bold;
    margin-bottom: 16px;
  }
  
  .desc {
    font-size: 14px;
    color: #666;
  }
}
`,
      source: 'mobile',
    });

    files.push({
      path: 'apps/mobile/src/pages/index/index.config.ts',
      content: `export default definePageConfig({
  navigationBarTitleText: '首页',
});
`,
      source: 'mobile',
    });

    return files;
  }

  private generateEnvFiles(config: GenerateProjectDto, resourceCredentials?: ResourceCredential[]): GeneratedFile[] {
    const files: GeneratedFile[] = [];
    const envVars = this.registryService.generateEnvVars(config.features);
    const resourceExampleEnvVars = this.resolveResourceExampleEnvVars(config);
    const database = this.resolveDatabaseSettings(config);
    const hasResourceDatabaseUrl = resourceExampleEnvVars.some((content) => (
      content.split('\n').some((line) => line.startsWith('DATABASE_URL='))
    ));

    // 基础环境变量
    const baseEnvVars = [
      '# Application',
      'NODE_ENV=development',
      'PORT=3000',
    ];

    if (!hasResourceDatabaseUrl) {
      baseEnvVars.push(
        '',
        '# Database',
        `DATABASE_URL="${database.defaultUrl}"`,
      );
    }

    // 添加功能相关的环境变量
    if (envVars.length > 0) {
      baseEnvVars.push('', '# Features');
      baseEnvVars.push(...envVars);
    }

    if (resourceExampleEnvVars.length > 0) {
      baseEnvVars.push('', '# Resource Configuration');
      baseEnvVars.push(...resourceExampleEnvVars);
    }

    // .env.example (所有变量，值为空或默认值)
    files.push({
      path: '.env.example',
      content: baseEnvVars.join('\n'),
      source: 'env',
    });

    // .env (填充用户凭证)
    if (resourceCredentials && resourceCredentials.length > 0) {
      const envWithCredentials = [...baseEnvVars];
      envWithCredentials.push('', '# Resource Credentials (Auto-generated)');
      
      for (const credential of resourceCredentials) {
        const envContent = this.registryService.generateResourceEnvVars(
          credential.type,
          credential.config
        );
        if (envContent) {
          envWithCredentials.push(envContent);
        }
      }
      
      files.push({
        path: '.env',
        content: envWithCredentials.join('\n'),
        source: 'env',
      });
    }

    return files;
  }

  private resolveResourceExampleEnvVars(config: GenerateProjectDto): string[] {
    const resources = config.resources || {};
    const envVars: string[] = [];

    for (const [resourceType, resource] of Object.entries(resources)) {
      if (!resource || typeof resource !== 'object') {
        continue;
      }

      const value = resource as ProjectResourceConfig;
      const type = value.type || resourceType;
      const registryResource = this.registryService.getResourceType(type);
      if (!registryResource) {
        continue;
      }

      const templateConfig = registryResource.fields.reduce<Record<string, unknown>>((acc, field) => {
        acc[field.key] = field.default ?? '';
        return acc;
      }, {});
      const envContent = this.registryService.generateResourceEnvVars(type, templateConfig);

      if (envContent) {
        envVars.push(envContent);
      }
    }

    return [...new Set(envVars)];
  }

  private resolveResourceCredentials(config: GenerateProjectDto): ResourceCredential[] {
    const resources = config.resources || {};
    const credentials: ResourceCredential[] = [];

    for (const [resourceType, resource] of Object.entries(resources)) {
      if (!resource || typeof resource !== 'object') {
        continue;
      }

      const value = resource as ProjectResourceConfig;
      if (value.mode !== 'manual' || !value.config) {
        continue;
      }

      credentials.push({
        type: value.type || resourceType,
        config: value.config,
      });
    }

    return credentials;
  }

  private generateDockerCompose(config: GenerateProjectDto): GeneratedFile {
    const services: Record<string, Record<string, unknown>> = {};
    const requiredResources = this.registryService.resolveResources(config.features);
    const volumes: string[] = [];
    const database = this.resolveDatabaseSettings(config);

    if (config.subProjects.backend) {
      if (database.engine === 'mysql') {
        services.mysql = {
          image: 'mysql:8.0',
          container_name: `${config.basicInfo.name}-mysql`,
          environment: {
            MYSQL_ROOT_PASSWORD: 'password',
            MYSQL_DATABASE: 'mydb',
          },
          ports: ['3306:3306'],
          volumes: ['mysql_data:/var/lib/mysql'],
          restart: 'unless-stopped',
        };
        volumes.push('mysql_data');
      }

      if (database.engine === 'postgresql') {
        services.postgres = {
          image: 'postgres:15-alpine',
          container_name: `${config.basicInfo.name}-postgres`,
          environment: {
            POSTGRES_USER: 'postgres',
            POSTGRES_PASSWORD: 'postgres',
            POSTGRES_DB: 'mydb',
          },
          ports: ['5432:5432'],
          volumes: ['postgres_data:/var/lib/postgresql/data'],
          restart: 'unless-stopped',
        };
        volumes.push('postgres_data');
      }
    }

    // Redis
    if (requiredResources.includes('redis')) {
      services.redis = {
        image: 'redis:7-alpine',
        container_name: `${config.basicInfo.name}-redis`,
        command: 'redis-server --appendonly yes',
        ports: ['6379:6379'],
        volumes: ['redis_data:/data'],
        restart: 'unless-stopped',
      };
      volumes.push('redis_data');
    }

    // 生成 YAML 内容
    const yamlContent = this.generateDockerComposeYaml(services, volumes);

    return {
      path: 'docker-compose.yml',
      content: yamlContent,
      source: 'docker',
    };
  }

  private generateDockerComposeYaml(
    services: Record<string, Record<string, unknown>>,
    volumes: string[]
  ): string {
    const lines: string[] = ['version: "3.8"', ''];

    if (Object.keys(services).length === 0) {
      lines.push('services: {}');
      return lines.join('\n');
    }

    lines.push('services:');

    for (const [name, config] of Object.entries(services)) {
      lines.push(`  ${name}:`);
      for (const [key, value] of Object.entries(config)) {
        if (Array.isArray(value)) {
          lines.push(`    ${key}:`);
          for (const item of value) {
            lines.push(`      - "${item}"`);
          }
        } else if (typeof value === 'object' && value !== null) {
          lines.push(`    ${key}:`);
          for (const [k, v] of Object.entries(value as Record<string, string>)) {
            lines.push(`      ${k}: "${v}"`);
          }
        } else {
          lines.push(`    ${key}: ${value}`);
        }
      }
      lines.push('');
    }

    if (volumes.length > 0) {
      lines.push('volumes:');
      for (const vol of volumes) {
        lines.push(`  ${vol}:`);
      }
    }

    return lines.join('\n');
  }

  private resolveDatabaseSettings(config: GenerateProjectDto): DatabaseSettings {
    const rawEngine = config.database?.engine || DEFAULT_DATABASE_ENGINE;
    const engine = DATABASE_ENGINE_ALIASES[rawEngine] || DEFAULT_DATABASE_ENGINE;
    return DATABASE_SETTINGS[engine];
  }

  async persistProjectZipArtifact(
    teamId: string,
    projectId: string,
    projectName: string,
    zipBuffer: Buffer,
  ): Promise<ProjectZipArtifact> {
    const fileName = this.buildProjectZipFileName(projectName);
    const filePath = this.resolveProjectZipArtifactPath(teamId, projectId, fileName);
    const generatedAt = new Date();
    const retentionDays = this.getArtifactRetentionDays();

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, zipBuffer);

    return {
      kind: 'project_zip',
      storage: 'local',
      fileName,
      size: zipBuffer.length,
      sha256: createHash('sha256').update(zipBuffer).digest('hex'),
      generatedAt: generatedAt.toISOString(),
      downloadUrl: `/api/projects/${encodeURIComponent(projectId)}/download`,
      retentionDays,
      expiresAt: this.buildArtifactExpiresAt(generatedAt, retentionDays),
    };
  }

  async resolveProjectZipArtifact(
    teamId: string,
    projectId: string,
    projectName: string,
    config?: unknown,
  ): Promise<ResolvedProjectZipArtifact> {
    const configuredArtifact = this.readProjectZipArtifact(config);
    const fileName = configuredArtifact?.fileName || this.buildProjectZipFileName(projectName);
    const filePath = this.resolveProjectZipArtifactPath(teamId, projectId, fileName);

    try {
      const artifactStat = await stat(filePath);
      const generatedAt = configuredArtifact?.generatedAt || artifactStat.mtime.toISOString();
      const retentionDays = configuredArtifact?.retentionDays || this.getArtifactRetentionDays();
      const expiresAt = configuredArtifact?.expiresAt || this.buildArtifactExpiresAt(generatedAt, retentionDays);

      if (this.isArtifactExpired(expiresAt)) {
        throw new GoneException('生成包已过期，请重新生成');
      }

      return {
        kind: 'project_zip',
        storage: 'local',
        fileName,
        size: configuredArtifact?.size || artifactStat.size,
        sha256: configuredArtifact?.sha256 || '',
        generatedAt,
        downloadUrl: configuredArtifact?.downloadUrl || `/api/projects/${encodeURIComponent(projectId)}/download`,
        retentionDays,
        expiresAt,
        lastDownloadedAt: configuredArtifact?.lastDownloadedAt,
        lastDownloadedBy: configuredArtifact?.lastDownloadedBy,
        downloadCount: configuredArtifact?.downloadCount,
        filePath,
      };
    } catch (error) {
      if (error instanceof GoneException) {
        throw error;
      }

      throw new NotFoundException('生成包不存在或已被清理');
    }
  }

  async cleanupExpiredProjectZipArtifacts(options: { dryRun?: boolean; now?: Date } = {}): Promise<ProjectZipArtifactCleanupResult> {
    const dryRun = options.dryRun ?? true;
    const now = options.now ?? new Date();
    const artifacts: ProjectZipArtifactCleanupResult['artifacts'] = [];
    const files = await this.listLocalArtifactFiles(this.getArtifactRoot());
    const retentionDays = this.getArtifactRetentionDays();
    let expired = 0;
    let deleted = 0;

    for (const filePath of files) {
      const artifactStat = await stat(filePath);
      const generatedAt = artifactStat.mtime.toISOString();
      const expiresAt = this.buildArtifactExpiresAt(generatedAt, retentionDays);
      const isExpired = this.isArtifactExpired(expiresAt, now);

      if (!isExpired) {
        continue;
      }

      expired += 1;

      if (!dryRun) {
        await rm(filePath, { force: true });
        deleted += 1;
      }

      artifacts.push({
        filePath,
        fileName: path.basename(filePath),
        size: artifactStat.size,
        generatedAt,
        expiresAt,
        deleted: !dryRun,
      });
    }

    return {
      dryRun,
      scanned: files.length,
      expired,
      deleted,
      artifacts,
    };
  }

  private async listLocalArtifactFiles(root: string): Promise<string[]> {
    try {
      const entries = await readdir(root, { withFileTypes: true });
      const files = await Promise.all(entries.map(async entry => {
        const entryPath = path.join(root, entry.name);

        if (entry.isDirectory()) {
          return this.listLocalArtifactFiles(entryPath);
        }

        if (entry.isFile() && entry.name.endsWith('.zip')) {
          return [entryPath];
        }

        return [];
      }));

      return files.flat();
    } catch {
      return [];
    }
  }

  private getArtifactRoot(): string {
    return process.env.DEVPILOT_GENERATED_PROJECTS_DIR || DEFAULT_ARTIFACT_ROOT;
  }

  private getArtifactRetentionDays(): number {
    const rawRetentionDays = Number.parseInt(process.env.DEVPILOT_GENERATED_PROJECT_ARTIFACT_RETENTION_DAYS || '', 10);
    if (Number.isFinite(rawRetentionDays) && rawRetentionDays > 0) {
      return rawRetentionDays;
    }

    return DEFAULT_ARTIFACT_RETENTION_DAYS;
  }

  private buildArtifactExpiresAt(generatedAt: string | Date, retentionDays: number): string {
    const generatedAtTime = generatedAt instanceof Date ? generatedAt.getTime() : Date.parse(generatedAt);
    const baseTime = Number.isFinite(generatedAtTime) ? generatedAtTime : Date.now();
    return new Date(baseTime + retentionDays * DAY_IN_MS).toISOString();
  }

  private isArtifactExpired(expiresAt: string, now: Date = new Date()): boolean {
    const expiresAtTime = Date.parse(expiresAt);
    return Number.isFinite(expiresAtTime) && expiresAtTime <= now.getTime();
  }

  private resolveProjectZipArtifactPath(teamId: string, projectId: string, fileName: string): string {
    return path.join(
      this.getArtifactRoot(),
      this.sanitizePathSegment(teamId),
      this.sanitizePathSegment(projectId),
      this.sanitizeFileName(fileName),
    );
  }

  private buildProjectZipFileName(projectName: string): string {
    const baseName = this.sanitizeFileName(projectName.replace(/\.zip$/i, '')) || 'project';
    return `${baseName}.zip`;
  }

  private sanitizePathSegment(value: string): string {
    return this.sanitizeFileName(value) || 'unknown';
  }

  private sanitizeFileName(value: string): string {
    return value
      .trim()
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
  }

  private readProjectZipArtifact(config?: unknown): ProjectZipArtifact | null {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return null;
    }

    const artifact = (config as Record<string, unknown>).generatedArtifact;
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
      return null;
    }

    const value = artifact as Partial<ProjectZipArtifact>;
    if (value.kind !== 'project_zip' || value.storage !== 'local' || typeof value.fileName !== 'string') {
      return null;
    }

    return {
      kind: 'project_zip',
      storage: 'local',
      fileName: value.fileName,
      size: typeof value.size === 'number' ? value.size : 0,
      sha256: typeof value.sha256 === 'string' ? value.sha256 : '',
      generatedAt: typeof value.generatedAt === 'string' ? value.generatedAt : '',
      downloadUrl: typeof value.downloadUrl === 'string' ? value.downloadUrl : '',
      retentionDays: typeof value.retentionDays === 'number' && value.retentionDays > 0
        ? value.retentionDays
        : this.getArtifactRetentionDays(),
      expiresAt: typeof value.expiresAt === 'string' && value.expiresAt
        ? value.expiresAt
        : this.buildArtifactExpiresAt(
            typeof value.generatedAt === 'string' ? value.generatedAt : new Date(),
            typeof value.retentionDays === 'number' && value.retentionDays > 0
              ? value.retentionDays
              : this.getArtifactRetentionDays(),
          ),
      lastDownloadedAt: typeof value.lastDownloadedAt === 'string' ? value.lastDownloadedAt : undefined,
      lastDownloadedBy: typeof value.lastDownloadedBy === 'string' ? value.lastDownloadedBy : undefined,
      downloadCount: typeof value.downloadCount === 'number' && value.downloadCount >= 0 ? value.downloadCount : undefined,
    };
  }

  async createZipBuffer(files: GeneratedFile[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const archive = archiver('zip', { zlib: { level: 9 } });

      const writable = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });

      writable.on('finish', () => {
        resolve(Buffer.concat(chunks));
      });

      archive.on('error', reject);
      archive.pipe(writable);

      for (const file of files) {
        archive.append(file.content, { name: file.path });
      }

      archive.finalize();
    });
  }
}
