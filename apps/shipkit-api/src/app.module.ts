import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { HttpModule } from '@svton/nestjs-http';
import { DatabaseService } from './database/database.service.js';
import { PlatformExecutorService } from './executor/platform-executor.service.js';
import { LocalPolicyService } from './policy/local-policy.service.js';
import { LocalRequestGuard } from './policy/local-request.guard.js';
import { ProjectController } from './projects/project.controller.js';
import { ProjectRepository } from './projects/project.repository.js';
import { ProjectService } from './projects/project.service.js';
import { PlanService } from './tasks/plan.service.js';
import { TaskController } from './tasks/task.controller.js';
import { TaskEventService } from './tasks/task-event.service.js';
import { TaskLogService } from './tasks/task-log.service.js';
import { TaskRepository } from './tasks/task.repository.js';
import { TaskRunnerService } from './tasks/task-runner.service.js';
import { TaskService } from './tasks/task.service.js';
import { ApiErrorFilter } from './transport/api-error.filter.js';
import { AgentController } from './agents/agent.controller.js';
import { AgentService } from './agents/agent.service.js';
import { AuthController } from './auth/auth.controller.js';
import { HealthController } from './auth/health.controller.js';
import { AuthService } from './auth/auth.service.js';
import { AuthSettings } from './auth/settings.js';
import { SessionStore } from './auth/session-store.js';
import { LoginBudget } from './auth/login-budget.js';
import { AccountAdmin } from './auth/accounts.js';
import { configControllers, configProviders } from './configs/config.module.js';
import { ProjectSourceService } from './projects/project-source.service.js';
import { RepositoryProjectService } from './projects/repository-project.service.js';
import { ProjectRepositoryController, RepositoryPreviewController } from './projects/repository.controller.js';
import { PlanInputService } from './tasks/plan-input.service.js';
import { registrationControllers, registrationProviders } from './registration/registration.module.js';
import { PlatformRequestGuard } from './transport/platform-request.guard.js';

@Module({
  imports: [HttpModule.forRoot({ enableResponseInterceptor: false, enableExceptionFilter: false })],
  controllers: [ProjectController, TaskController, AgentController, AuthController, HealthController,
    RepositoryPreviewController, ProjectRepositoryController, ...configControllers, ...registrationControllers],
  providers: [DatabaseService, PlatformExecutorService, LocalPolicyService, ProjectRepository, ProjectService, PlanService,
    TaskRepository, TaskEventService, TaskLogService, TaskRunnerService, TaskService, AgentService,
    AuthService, AuthSettings, SessionStore, LoginBudget, AccountAdmin,
    ProjectSourceService, RepositoryProjectService, PlanInputService, ...configProviders, ...registrationProviders, LocalRequestGuard,
    { provide: APP_GUARD, useClass: PlatformRequestGuard }, { provide: APP_FILTER, useClass: ApiErrorFilter }],
})
export class AppModule {}
