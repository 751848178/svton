import { BadRequestException } from '@nestjs/common';
import type { DraftValues, ServicePatch, ServiceValues, Variable, VariablePatch } from './config.types.js';

function patchVariables(current: Record<string, Variable>, patches: VariablePatch[] = []): Record<string, Variable> {
  const result: Record<string, Variable> = Object.assign(Object.create(null), current);
  for (const patch of patches) {
    if (patch.delete) { delete result[patch.key]; continue; }
    const previous = Object.hasOwn(result, patch.key) ? result[patch.key] : undefined;
    if (patch.value === undefined && !previous) throw new BadRequestException('新变量必须明确设置值');
    result[patch.key] = { value: patch.value ?? previous!.value, secret: patch.secret ?? previous?.secret ?? true };
  }
  return result;
}
export function patchValues(current: DraftValues, defaults: VariablePatch[] | undefined, services: ServicePatch[] | undefined, serviceKeys: string[]): DraftValues {
  const result: DraftValues = { defaults: patchVariables(current.defaults, defaults), services: Object.assign(Object.create(null), current.services) };
  for (const patch of services ?? []) {
    if (!serviceKeys.includes(patch.serviceKey)) throw new BadRequestException('配置引用了未注册的服务');
    const old = Object.hasOwn(result.services, patch.serviceKey) ? result.services[patch.serviceKey]! : { noEnv: false, variables: {} };
    const next = { noEnv: patch.noEnv ?? old.noEnv, variables: patchVariables(old.variables, patch.variables) };
    if (next.noEnv && Object.keys(next.variables).length) throw new BadRequestException('无需环境变量的服务不能同时设置变量，请先明确删除');
    result.services[patch.serviceKey] = next;
  }
  return result;
}
export function expandValues(draft: DraftValues): Record<string, ServiceValues> {
  return Object.fromEntries(Object.entries(draft.services).map(([key, service]) => [key, {
    noEnv: service.noEnv, variables: service.noEnv ? {} : { ...draft.defaults, ...service.variables },
  }]));
}
export function validateFrozen(services: Record<string, ServiceValues>, registered: string[]): void {
  if (!Object.keys(services).length) throw new BadRequestException('配置版本必须明确覆盖至少一个服务');
  for (const [key, service] of Object.entries(services)) {
    if (!registered.includes(key)) throw new BadRequestException('服务范围已变更，请重新核对');
    if (!service.noEnv && !Object.keys(service.variables).length) throw new BadRequestException('空配置必须明确声明无需环境变量');
  }
}
