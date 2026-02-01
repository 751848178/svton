import { Injectable, Logger } from '@nestjs/common';
import * as archiver from 'archiver';
import { Writable } from 'stream';
import { RegistryService } from '../registry/registry.service';
import { GenerateProjectDto } from './dto/generate.dto';

export interface GeneratedFile {
  path: string;
  content: string;
  source?: string; // 标记文件来源（哪个功能生成的）
}

export interface ResourceCredential {
  type: string;
  config: Record<string, unknown>;
}

@Injectable()
export class GeneratorService {
  private readonly logger = new Logger(GeneratorService.name);

  constructor(private readonly registryService: RegistryService) {}

  async generateProject(config: GenerateProjectDto, resourceCredentials?: ResourceCredential[]): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const { basicInfo, subProjects, features } = config;

    // 解析所有需要的包
    const allPackages = this.resolveAllPackages(config);

    // 生成根目录文件
    files.push(...this.generateRootFiles(basicInfo, allPackages));

    // 生成 Git 初始化文件
    files.push(...this.generateGitFiles(basicInfo));

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
    files.push(...this.generateEnvFiles(config, resourceCredentials));

    // 生成 Docker Compose
    files.push(this.generateDockerCompose(config));

    this.logger.log(`Generated ${files.length} files for project: ${basicInfo.name}`);

    return files;
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

  private generateRootFiles(basicInfo: GenerateProjectDto['basicInfo'], packages: Set<string>): GeneratedFile[] {
    const files: GeneratedFile[] = [];

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
  private generateGitFiles(basicInfo: GenerateProjectDto['basicInfo']): GeneratedFile[] {
    const files: GeneratedFile[] = [];

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

- **后端**: NestJS + Prisma + PostgreSQL
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
  provider = "postgresql"
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

    // 基础环境变量
    const baseEnvVars = [
      '# Application',
      'NODE_ENV=development',
      'PORT=3000',
      '',
      '# Database',
      'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mydb?schema=public"',
    ];

    // 添加功能相关的环境变量
    if (envVars.length > 0) {
      baseEnvVars.push('', '# Features');
      baseEnvVars.push(...envVars);
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

  private generateDockerCompose(config: GenerateProjectDto): GeneratedFile {
    const services: Record<string, Record<string, unknown>> = {};
    const requiredResources = this.registryService.resolveResources(config.features);
    const volumes: string[] = [];

    // PostgreSQL (默认)
    if (config.subProjects.backend) {
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
    const lines: string[] = ['version: "3.8"', '', 'services:'];

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
