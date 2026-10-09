import { BadRequestException } from '@nestjs/common';
import type { PlanRequest } from '../executor/executor.port.js';

export function planRequest(body: Record<string, unknown>): PlanRequest {
  if (!['release', 'rollback', 'config-only'].includes(String(body.kind))) throw new BadRequestException('需要有效的发布类型');
  if (!Array.isArray(body.services) || !body.services.length || body.services.length > 100 || body.services.some(s => typeof s !== 'string' || !/^[a-z][a-z0-9-]{0,62}$/.test(s))) throw new BadRequestException('需要明确选择有效服务');
  if (new Set(body.services).size !== body.services.length) throw new BadRequestException('服务选择重复');
  if (body.sourceMode !== undefined && !['git', 'directory'].includes(String(body.sourceMode))) throw new BadRequestException('来源模式无效');
  for (const key of ['keepEnv', 'keepBuilder']) if (body[key] !== undefined && typeof body[key] !== 'boolean') throw new BadRequestException(`${key} 必须为布尔值`);
  if (body.changeReleaseId !== undefined && (typeof body.changeReleaseId !== 'string' || !/^[a-z0-9-]{6,40}$/.test(body.changeReleaseId))) throw new BadRequestException('历史变更记录无效');
  const mode = body.configMode as PlanRequest['configMode'];
  if (mode !== undefined && !['files', 'inherit', 'version'].includes(mode)) throw new BadRequestException('环境配置策略无效');
  if (mode === 'version' && (typeof body.configVersionId !== 'string' || !body.configVersionId || body.configVersionId.length > 100)) throw new BadRequestException('需要冻结的配置版本');
  if (mode !== 'version' && body.configVersionId !== undefined) throw new BadRequestException('只有版本策略可以选择配置版本');
  if (mode === 'version' && body.keepEnv) throw new BadRequestException('应用配置版本与继承配置不能同时选择');
  if (mode === 'files' && body.keepEnv || mode === 'inherit' && body.keepEnv === false) throw new BadRequestException('环境配置策略与旧继承参数冲突');
  if (body.kind === 'config-only' && (mode === 'inherit' || body.keepEnv || !mode)) throw new BadRequestException('仅配置发布需要明确应用新的配置');
  if (body.kind === 'config-only' && (body.sourceRef !== undefined || body.keepBuilder)) throw new BadRequestException('仅配置发布复用当前镜像，不选择源码或构建机');
  if (body.kind === 'rollback' && (mode !== undefined || body.configVersionId !== undefined || body.sourceRef !== undefined || body.keepEnv)) throw new BadRequestException('回滚恢复历史镜像与配置，不应用新的配置或源码');
  let sourceRef: PlanRequest['sourceRef'];
  if (body.sourceRef !== undefined) {
    const ref = body.sourceRef as Record<string, unknown>;
    if (!ref || !['branch', 'tag', 'commit'].includes(String(ref.kind)) || typeof ref.value !== 'string' || ref.value.length > 256 || /[\u0000-\u0020]/.test(ref.value) || ref.value.startsWith('-') || (!ref.value && ref.kind !== 'branch')) throw new BadRequestException('源码引用无效');
    sourceRef = { kind: ref.kind as NonNullable<PlanRequest['sourceRef']>['kind'], value: ref.value };
  }
  return { kind: body.kind as PlanRequest['kind'], services: body.services as string[], sourceMode: body.sourceMode as PlanRequest['sourceMode'],
    changeReleaseId: body.changeReleaseId as string | undefined, keepEnv: body.keepEnv as boolean | undefined,
    keepBuilder: body.keepBuilder as boolean | undefined, sourceRef, configMode: mode, configVersionId: body.configVersionId as string | undefined };
}
