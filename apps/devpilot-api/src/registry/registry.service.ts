import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface Feature {
  id: string;
  name: string;
  description: string;
  category: string;
  packages: string[];
  requiredResources: string[];
  applicableTo: string[];
  codeSnippets: {
    moduleImport: string;
    envVars: string[];
  };
}

export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface SubProject {
  id: string;
  name: string;
  description: string;
  framework: string;
  icon: string;
  defaultEnabled: boolean;
  basePackages: string[];
  optionalPackages?: Record<string, string>;
  templateDir: string;
}

export interface FrontendLibrary {
  id: string;
  name: string;
  description: string;
  applicableTo: string[];
  package: string;
}

export interface ResourceType {
  id: string;
  name: string;
  description: string;
  icon: string;
  fields: {
    key: string;
    label: string;
    type: string;
    required: boolean;
    default?: string | number;
  }[];
  envTemplate: string;
}

// 包依赖映射
export interface PackageDependency {
  name: string;
  version: string;
  peerDependencies?: string[];
}

// 解析后的包信息
export interface ResolvedPackages {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

@Injectable()
export class RegistryService implements OnModuleInit {
  private readonly logger = new Logger(RegistryService.name);
  
  private features: Feature[] = [];
  private categories: Category[] = [];
  private subProjects: SubProject[] = [];
  private frontendLibraries: FrontendLibrary[] = [];
  private resourceTypes: ResourceType[] = [];

  onModuleInit() {
    this.loadConfigs();
  }

  private loadConfigs() {
    const configDir = path.join(__dirname, '..', 'config');

    try {
      // 加载功能配置
      const featuresConfig = JSON.parse(
        fs.readFileSync(path.join(configDir, 'features.json'), 'utf-8')
      );
      this.features = featuresConfig.features;
      this.categories = featuresConfig.categories;

      // 加载子项目配置
      const subProjectsConfig = JSON.parse(
        fs.readFileSync(path.join(configDir, 'sub-projects.json'), 'utf-8')
      );
      this.subProjects = subProjectsConfig.subProjects;
      this.frontendLibraries = subProjectsConfig.frontendLibraries;

      // 加载资源类型配置
      const resourcesConfig = JSON.parse(
        fs.readFileSync(path.join(configDir, 'resources.json'), 'utf-8')
      );
      this.resourceTypes = resourcesConfig.resources;

      this.logger.log(`Loaded ${this.features.length} features, ${this.subProjects.length} sub-projects, ${this.resourceTypes.length} resource types`);
    } catch (error) {
      this.logger.error('Failed to load config files', error);
    }
  }

  // 获取所有功能
  getFeatures(): Feature[] {
    return this.features;
  }

  // 获取功能分类
  getCategories(): Category[] {
    return this.categories.sort((a, b) => a.order - b.order);
  }

  // 按分类获取功能
  getFeaturesByCategory(): Record<string, Feature[]> {
    const result: Record<string, Feature[]> = {};
    
    for (const category of this.categories) {
      result[category.id] = this.features.filter(f => f.category === category.id);
    }
    
    return result;
  }

  // 根据子项目过滤可用功能
  getAvailableFeatures(subProjectIds: string[]): Feature[] {
    return this.features.filter(feature =>
      feature.applicableTo.some(sp => subProjectIds.includes(sp))
    );
  }

  // 获取功能详情
  getFeature(id: string): Feature | undefined {
    return this.features.find(f => f.id === id);
  }

  // 解析功能依赖的包
  resolvePackages(featureIds: string[]): string[] {
    const packages = new Set<string>();
    
    for (const featureId of featureIds) {
      const feature = this.getFeature(featureId);
      if (feature) {
        feature.packages.forEach(pkg => packages.add(pkg));
      }
    }
    
    return Array.from(packages);
  }

  // 解析功能需要的资源
  resolveResources(featureIds: string[]): string[] {
    const resources = new Set<string>();
    
    for (const featureId of featureIds) {
      const feature = this.getFeature(featureId);
      if (feature) {
        feature.requiredResources.forEach(r => resources.add(r));
      }
    }
    
    return Array.from(resources);
  }

  // 获取所有子项目类型
  getSubProjects(): SubProject[] {
    return this.subProjects;
  }

  // 获取子项目详情
  getSubProject(id: string): SubProject | undefined {
    return this.subProjects.find(sp => sp.id === id);
  }

  // 获取前端库
  getFrontendLibraries(): FrontendLibrary[] {
    return this.frontendLibraries;
  }

  // 根据子项目获取可用的前端库
  getAvailableFrontendLibraries(subProjectIds: string[]): FrontendLibrary[] {
    return this.frontendLibraries.filter(lib =>
      lib.applicableTo.some(sp => subProjectIds.includes(sp))
    );
  }

  // 获取所有资源类型
  getResourceTypes(): ResourceType[] {
    return this.resourceTypes;
  }

  // 获取资源类型详情
  getResourceType(id: string): ResourceType | undefined {
    return this.resourceTypes.find(r => r.id === id);
  }

  // 生成环境变量
  generateEnvVars(featureIds: string[]): string[] {
    const envVars: string[] = [];
    
    for (const featureId of featureIds) {
      const feature = this.getFeature(featureId);
      if (feature) {
        envVars.push(...feature.codeSnippets.envVars);
      }
    }
    
    return [...new Set(envVars)];
  }

  // 包版本映射
  private readonly packageVersions: Record<string, string> = {
    // svton 包使用 workspace
    '@svton/nestjs-logger': 'workspace:*',
    '@svton/nestjs-config-schema': 'workspace:*',
    '@svton/nestjs-redis': 'workspace:*',
    '@svton/nestjs-cache': 'workspace:*',
    '@svton/nestjs-http': 'workspace:*',
    '@svton/nestjs-authz': 'workspace:*',
    '@svton/nestjs-rate-limit': 'workspace:*',
    '@svton/nestjs-queue': 'workspace:*',
    '@svton/nestjs-object-storage': 'workspace:*',
    '@svton/nestjs-object-storage-qiniu-kodo': 'workspace:*',
    '@svton/nestjs-sms': 'workspace:*',
    '@svton/nestjs-oauth': 'workspace:*',
    '@svton/nestjs-payment': 'workspace:*',
    '@svton/ui': 'workspace:*',
    '@svton/taro-ui': 'workspace:*',
    '@svton/hooks': 'workspace:*',
    '@svton/service': 'workspace:*',
    '@svton/logger': 'workspace:*',
  };

  // 包的 peer 依赖
  private readonly peerDependencies: Record<string, string[]> = {
    '@svton/nestjs-cache': ['@svton/nestjs-redis'],
    '@svton/nestjs-rate-limit': ['@svton/nestjs-redis'],
    '@svton/nestjs-queue': ['@svton/nestjs-redis'],
    '@svton/nestjs-object-storage-qiniu-kodo': ['@svton/nestjs-object-storage'],
  };

  // 解析包依赖（包含 peer 依赖）
  resolvePackagesWithDependencies(featureIds: string[]): ResolvedPackages {
    const packages = new Set<string>();
    
    // 收集所有功能的包
    for (const featureId of featureIds) {
      const feature = this.getFeature(featureId);
      if (feature) {
        feature.packages.forEach(pkg => packages.add(pkg));
      }
    }
    
    // 解析 peer 依赖
    const resolvedPackages = new Set<string>(packages);
    for (const pkg of packages) {
      const peers = this.peerDependencies[pkg];
      if (peers) {
        peers.forEach(peer => resolvedPackages.add(peer));
      }
    }
    
    // 构建依赖对象
    const dependencies: Record<string, string> = {};
    for (const pkg of resolvedPackages) {
      dependencies[pkg] = this.packageVersions[pkg] || 'latest';
    }
    
    return { dependencies, devDependencies: {} };
  }

  // 根据子项目过滤功能
  filterFeaturesBySubProjects(featureIds: string[], subProjectIds: string[]): string[] {
    return featureIds.filter(featureId => {
      const feature = this.getFeature(featureId);
      if (!feature) return false;
      return feature.applicableTo.some(sp => subProjectIds.includes(sp));
    });
  }

  // 获取功能的模块导入代码
  getModuleImports(featureIds: string[]): { imports: string[]; modules: string[] } {
    const imports: string[] = [];
    const modules: string[] = [];
    
    for (const featureId of featureIds) {
      const feature = this.getFeature(featureId);
      if (feature && feature.codeSnippets.moduleImport) {
        // 解析包名
        const mainPackage = feature.packages[0];
        if (mainPackage) {
          const moduleName = this.getModuleNameFromPackage(mainPackage);
          imports.push(`import { ${moduleName} } from '${mainPackage}';`);
          modules.push(`    ${feature.codeSnippets.moduleImport},`);
        }
      }
    }
    
    return { imports, modules };
  }

  private getModuleNameFromPackage(packageName: string): string {
    // @svton/nestjs-cache -> CacheModule
    const name = packageName.replace('@svton/nestjs-', '').replace('@svton/', '');
    const parts = name.split('-');
    return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('') + 'Module';
  }

  // 生成资源的环境变量（带用户凭证）
  generateResourceEnvVars(resourceTypeId: string, config: Record<string, unknown>): string {
    const resourceType = this.getResourceType(resourceTypeId);
    if (!resourceType) return '';
    
    let envTemplate = resourceType.envTemplate;
    for (const [key, value] of Object.entries(config)) {
      envTemplate = envTemplate.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), String(value || ''));
    }
    
    return envTemplate;
  }
}
