import { BadRequestException } from "@nestjs/common";
import type {
  EnvironmentVariableBinding,
  SecretReferenceInput,
} from "./environment-config-revision.types";
import { ENVIRONMENT_VARIABLE_KEY_PATTERN } from "./environment-variable-key.policy";

const COMPONENT_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function normalizeSecretReferences(value: unknown): SecretReferenceInput[] {
  if (!Array.isArray(value)) throw new BadRequestException("Secret 引用必须是数组");
  const references = value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new BadRequestException(`Secret 引用 ${index + 1} 格式无效`);
    }
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== "string" || !item.id.trim()) {
      throw new BadRequestException(`Secret 引用 ${index + 1} 缺少 id`);
    }
    if (item.targetEnvKey !== undefined && (
      typeof item.targetEnvKey !== "string" || !ENVIRONMENT_VARIABLE_KEY_PATTERN.test(item.targetEnvKey)
    )) {
      throw new BadRequestException(`Secret 引用 ${index + 1} 的目标变量无效`);
    }
    return {
      id: item.id.trim(),
      ...(typeof item.targetEnvKey === "string" ? { targetEnvKey: item.targetEnvKey } : {}),
    };
  });
  if (new Set(references.map((item) => item.id)).size !== references.length) {
    throw new BadRequestException("Secret 引用存在重复 id");
  }
  return references;
}

export function normalizeResourceBindingFields(
  item: Record<string, unknown>,
  index: number,
  required = true,
) {
  const componentKey = optionalComponentKey(item.componentKey, index);
  const envBindings = optionalEnvBindings(item.envBindings, index);
  if (required && !componentKey) {
    throw new BadRequestException(`资源引用 ${index + 1} 必须指定目标组件`);
  }
  if (required && envBindings === undefined) {
    throw new BadRequestException(`资源引用 ${index + 1} 必须显式提供变量映射`);
  }
  return {
    ...(componentKey ? { componentKey } : {}),
    ...(envBindings ? { envBindings } : {}),
  };
}

function optionalComponentKey(value: unknown, index: number) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !COMPONENT_KEY_PATTERN.test(value.trim())) {
    throw new BadRequestException(`资源引用 ${index + 1} 的目标组件无效`);
  }
  return value.trim();
}

function optionalEnvBindings(value: unknown, index: number): EnvironmentVariableBinding[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new BadRequestException(`资源引用 ${index + 1} 的变量映射必须是数组`);
  }
  const bindings = value.map((entry, bindingIndex) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new BadRequestException(`资源引用 ${index + 1} 的变量映射 ${bindingIndex + 1} 无效`);
    }
    const item = entry as Record<string, unknown>;
    if (typeof item.sourceKey !== "string" || !ENVIRONMENT_VARIABLE_KEY_PATTERN.test(item.sourceKey)) {
      throw new BadRequestException(`资源引用 ${index + 1} 的来源变量无效`);
    }
    if (typeof item.targetEnvKey !== "string" || !ENVIRONMENT_VARIABLE_KEY_PATTERN.test(item.targetEnvKey)) {
      throw new BadRequestException(`资源引用 ${index + 1} 的目标变量无效`);
    }
    return { sourceKey: item.sourceKey, targetEnvKey: item.targetEnvKey };
  });
  if (new Set(bindings.map((item) => item.sourceKey)).size !== bindings.length) {
    throw new BadRequestException(`资源引用 ${index + 1} 存在重复来源变量映射`);
  }
  return bindings;
}
