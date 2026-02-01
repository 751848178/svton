import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 子项目类型
export type SubProjectType = 'backend' | 'admin' | 'mobile';

// 项目配置
export interface ProjectConfig {
  basicInfo: {
    name: string;
    orgName: string;
    description: string;
    packageManager: 'pnpm' | 'npm' | 'yarn';
  };
  subProjects: {
    backend: boolean;
    admin: boolean;
    mobile: boolean;
  };
  features: string[];
  resources: Record<string, string>; // resourceType -> credentialId
  uiLibrary: {
    admin: boolean;
    mobile: boolean;
  };
  hooks: boolean;
  gitConfig?: {
    provider: 'github' | 'gitlab' | 'gitee';
    repoName: string;
    visibility: 'public' | 'private';
    createNew: boolean;
  };
}

interface ProjectConfigState {
  config: ProjectConfig;
  currentStep: number;
  
  // Actions
  setBasicInfo: (info: Partial<ProjectConfig['basicInfo']>) => void;
  setSubProjects: (subProjects: Partial<ProjectConfig['subProjects']>) => void;
  toggleFeature: (featureId: string) => void;
  setFeatures: (features: string[]) => void;
  setResource: (resourceType: string, credentialId: string) => void;
  setUiLibrary: (lib: Partial<ProjectConfig['uiLibrary']>) => void;
  setHooks: (enabled: boolean) => void;
  setGitConfig: (config: ProjectConfig['gitConfig']) => void;
  setCurrentStep: (step: number) => void;
  reset: () => void;
  loadPreset: (config: ProjectConfig) => void;
}

const initialConfig: ProjectConfig = {
  basicInfo: {
    name: '',
    orgName: '',
    description: '',
    packageManager: 'pnpm',
  },
  subProjects: {
    backend: true,
    admin: false,
    mobile: false,
  },
  features: [],
  resources: {},
  uiLibrary: {
    admin: false,
    mobile: false,
  },
  hooks: false,
};

export const useProjectConfigStore = create<ProjectConfigState>()(
  persist(
    (set) => ({
      config: initialConfig,
      currentStep: 0,

      setBasicInfo: (info) =>
        set((state) => ({
          config: {
            ...state.config,
            basicInfo: { ...state.config.basicInfo, ...info },
          },
        })),

      setSubProjects: (subProjects) =>
        set((state) => ({
          config: {
            ...state.config,
            subProjects: { ...state.config.subProjects, ...subProjects },
          },
        })),

      toggleFeature: (featureId) =>
        set((state) => {
          const features = state.config.features.includes(featureId)
            ? state.config.features.filter((id) => id !== featureId)
            : [...state.config.features, featureId];
          return {
            config: { ...state.config, features },
          };
        }),

      setFeatures: (features) =>
        set((state) => ({
          config: { ...state.config, features },
        })),

      setResource: (resourceType, credentialId) =>
        set((state) => ({
          config: {
            ...state.config,
            resources: { ...state.config.resources, [resourceType]: credentialId },
          },
        })),

      setUiLibrary: (lib) =>
        set((state) => ({
          config: {
            ...state.config,
            uiLibrary: { ...state.config.uiLibrary, ...lib },
          },
        })),

      setHooks: (enabled) =>
        set((state) => ({
          config: { ...state.config, hooks: enabled },
        })),

      setGitConfig: (gitConfig) =>
        set((state) => ({
          config: { ...state.config, gitConfig },
        })),

      setCurrentStep: (step) => set({ currentStep: step }),

      reset: () => set({ config: initialConfig, currentStep: 0 }),

      loadPreset: (config) => set({ config, currentStep: 0 }),
    }),
    {
      name: 'project-config-storage',
    }
  )
);
