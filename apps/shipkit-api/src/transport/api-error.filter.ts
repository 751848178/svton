import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { isPrismaError, mapPrismaError } from '@svton/nestjs-http';
import type { Response } from 'express';
import type { LocalRequest } from '../policy/request-context.js';
import { publicData } from './public-data.js';
import { repositoryLimitResponse } from './repository-limit-response.js';

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<LocalRequest>();
    let status = 422;
    let code = 'EXECUTION_UNAVAILABLE';
    let message = '操作未能完成，请检查项目配置、Agent 连接或任务日志';
    const repositoryLimit = repositoryLimitResponse(error);
    if (repositoryLimit) {
      status = 429; code = repositoryLimit.code; message = repositoryLimit.message;
    } else if (error instanceof HttpException) {
      status = error.getStatus(); code = String(status);
      const body = error.getResponse();
      message = typeof body === 'string' ? body : String((body as { message?: unknown }).message ?? error.message);
      if (typeof body === 'object' && body !== null && typeof (body as { code?: unknown }).code === 'string') code = (body as { code: string }).code;
    } else if (isPrismaError(error)) {
      const mapped = mapPrismaError(error);
      status = mapped.status; code = String(mapped.code); message = mapped.message;
    } else if (error instanceof Error && /first deployment|first-deploy/i.test(error.message) && /missing required services|full|all services|required/i.test(error.message)) {
      status = 400; code = 'FIRST_DEPLOYMENT_FULL_REQUIRED'; message = '首次部署必须选择全部服务，当前没有可继承的已发布版本';
    } else if (error instanceof Error && /unknown service|empty selection|selection is empty|not declared in|选择.*服务/i.test(error.message)) {
      status = 400; code = 'SERVICE_SELECTION_INVALID'; message = '所选服务无效或为空，请按当前 ship.yaml 重新选择服务';
    } else if (error instanceof Error && /declared but neither selected nor present/i.test(error.message)) {
      status = 400; code = 'SERVICE_DEPLOYMENT_REQUIRED'; message = '新增服务尚未发布，必须加入本轮选择后才能继承其版本';
    } else if (error instanceof Error && /removing a running service requires explicit migration/i.test(error.message)) {
      status = 400; code = 'SERVICE_MIGRATION_REQUIRED'; message = '运行端存在当前 ship.yaml 未声明的服务，请恢复声明或先完成显式迁移';
    } else if (error instanceof Error && /outside the historical change/i.test(error.message)) {
      status = 400; code = 'ROLLBACK_SERVICE_SCOPE'; message = '所选服务不属于这条历史变更，请按历史服务范围选择';
    } else if (error instanceof Error && /external.*(?:does not exist|missing)|bind mount host path.*does not exist|external resources/i.test(error.message)) {
      status = 400; code = 'EXTERNAL_RESOURCE_REQUIRED'; message = '所选服务声明的外部网络、数据卷或宿主机目录不存在，请先按计划准备这些资源';
    } else if (error instanceof Error && /keep-env.*first deployment|no committed environment|no committed combination/i.test(error.message)) {
      status = 400; code = 'ENV_INHERITANCE_UNAVAILABLE'; message = '所选服务没有可继承的运行环境，请提供已声明的环境文件';
    } else if (error instanceof Error && /env.*(?:missing|not found|does not exist)|ENOENT.*\.env/i.test(error.message)) {
      status = 400; code = 'ENV_REFERENCE_MISSING'; message = '所选服务声明的环境文件不存在，请检查本机环境文件引用';
    } else if (error instanceof Error && /stale|changed|expired/i.test(error.message)) {
      status = 409; code = 'PLAN_STALE'; message = '计划基线或输入已发生变化，请重新核对计划';
    } else if (error instanceof Error && /snapshot|history.*(?:missing|available)|no previous/i.test(error.message)) {
      status = 409; code = 'SNAPSHOT_UNAVAILABLE'; message = '所选历史快照不存在或当前不可回滚，请刷新发布历史';
    }
    response.status(status).json({ code, message: publicData(message),
      ...(repositoryLimit?.retryAt ? { retryAt: repositoryLimit.retryAt } : {}), requestId: request.localContext?.requestId });
  }
}
