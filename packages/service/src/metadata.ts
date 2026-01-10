import type { ServiceClass, ServiceMetadata } from './types';

/**
 * Service 元数据存储
 */
const serviceMetadataMap = new WeakMap<ServiceClass, ServiceMetadata>();

/**
 * 获取或创建 Service 元数据
 */
export function getServiceMetadata(target: ServiceClass): ServiceMetadata {
  let metadata = serviceMetadataMap.get(target);
  if (!metadata) {
    metadata = {
      observables: new Set(),
      computeds: new Set(),
      actions: new Set(),
      injects: new Map(),
    };
    serviceMetadataMap.set(target, metadata);
  }
  return metadata;
}

/**
 * 获取原型链上的所有元数据（合并继承）
 */
export function getMergedMetadata(target: ServiceClass): ServiceMetadata {
  const merged: ServiceMetadata = {
    observables: new Set(),
    computeds: new Set(),
    actions: new Set(),
    injects: new Map(),
  };

  let current: ServiceClass | null = target;
  while (current && current !== Object) {
    const metadata = serviceMetadataMap.get(current);
    if (metadata) {
      metadata.observables.forEach((k) => merged.observables.add(k));
      metadata.computeds.forEach((k) => merged.computeds.add(k));
      metadata.actions.forEach((k) => merged.actions.add(k));
      metadata.injects.forEach((v, k) => {
        if (!merged.injects.has(k)) {
          merged.injects.set(k, v);
        }
      });
      if (metadata.name && !merged.name) {
        merged.name = metadata.name;
      }
    }
    current = Object.getPrototypeOf(current);
  }

  return merged;
}
