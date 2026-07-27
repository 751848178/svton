import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  RELEASE_DEPENDENCY_CONDITION_TYPES,
  RELEASE_STAGE_TYPES,
} from "../types/release-orchestration.types";

/**
 * 发布计划中选择某个应用服务的输入 DTO（F383 Slice 8a）。
 *
 * 安全契约（invest-3 §A.5）：DTO 只承载选择器字段——
 * applicationId/applicationServiceId/environmentId/serverId/serviceName
 * + 非原始 shell 的可选覆盖（backfill 标记）。
 *
 * 原始 shell 命令字段（preStartCheckCommand/migrationCommand/
 * initializationCommand/deployCommand/healthCheckUrl/backfillCommand）
 * 一律不从客户端接受——控制器从 ApplicationService.deployConfig 在服务端读取，
 * 避免 "前端命令被信任" 的远程执行面。详见
 * utils/release-service-config.utils.ts。
 */
export class ReleaseServiceInputDto {
  @IsString()
  applicationId!: string;

  @IsString()
  applicationServiceId!: string;

  @IsString()
  environmentId!: string;

  @IsOptional()
  @IsString()
  serverId?: string;

  @IsString()
  serviceName!: string;

  // 仅可选非 shell 覆盖：backfill 是否必需（影响 DAG 边条件 + 是否生成阶段）。
  // backfillCommand 本身从 deployConfig 服务端读取，不允许前端覆盖。
  @IsOptional()
  @IsBoolean()
  backfillRequired?: boolean;
}

// 跨服务依赖声明边（显式，Devpilot 不推断）。每条边字段必填，数组本身可选。
export class ServiceDependencyDto {
  @IsString()
  fromServiceId!: string;

  @IsIn([...RELEASE_STAGE_TYPES])
  fromStageType!: string;

  @IsString()
  toServiceId!: string;

  @IsIn([...RELEASE_STAGE_TYPES])
  toStageType!: string;

  @IsIn([...RELEASE_DEPENDENCY_CONDITION_TYPES])
  conditionType!: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class PreviewReleasePlanDto {
  @IsString()
  environmentId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsString()
  commitSha?: string;

  @IsOptional()
  @IsString()
  gitRepo?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceDependencyDto)
  serviceDependencies?: ServiceDependencyDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReleaseServiceInputDto)
  services!: ReleaseServiceInputDto[];
}

export class CreateReleasePlanDto extends PreviewReleasePlanDto {
  // preview ↔ create 强绑定（invest-3 §C）：客户端把上一次 preview 返回的 planHash
  // 回传；service.create 重新计算 preview 并比对，不一致则 409 RELEASE_PLAN_STALE。
  // 暂时可选，向后兼容现有 fixture；UI（Slice 8b）将恒发送。
  @IsOptional()
  @IsString()
  expectedPlanHash?: string;
}

export class SkipReleaseStageDto {
  @IsString()
  reason!: string;

  @IsString()
  confirmationText!: string;
}

export class ListReleasePlansQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
