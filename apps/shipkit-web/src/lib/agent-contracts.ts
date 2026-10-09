export interface AgentBinding {
  id: string; projectId: string; projectName: string; locator: string; usage: 'runtime' | 'builder';
  targetKey?: string; displayName?: string | null; selected: boolean;
}
export interface AgentResource { id: string; endpoint: string; usages: Array<'runtime' | 'builder'>; bindings: AgentBinding[] }
export interface DynamicBuilderPolicy { projectId: string; projectName: string; provider: string; region?: string; zone?: string; instanceType?: string }
export interface AgentResourceList {
  items: AgentResource[]; dynamicBuilders: DynamicBuilderPolicy[];
  issues: Array<{ projectId: string; projectName: string; message: string }>;
}
export interface AgentBindingCheck {
  bindingId: string; ok: boolean; checkedAt: string; version?: string;
  machineRole?: 'runtime' | 'builder' | 'both'; accessRole?: 'runtime' | 'builder' | 'both'; docker?: boolean; error?: string;
}
export interface AgentResourceChecks {
  resourceId: string; checkedAt: string; status: 'succeeded' | 'partial' | 'failed'; checks: AgentBindingCheck[];
}
