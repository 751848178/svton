import 'reflect-metadata';
import { CanActivate, Controller, ExecutionContext, Get, Inject, Injectable, Module, Post, Req, SetMetadata } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, NestFactory } from '@nestjs/core';
import { json } from 'express';
import { request as httpRequest } from 'node:http';
import { randomBytes } from 'node:crypto';
import { AuthController } from '../auth/auth.controller.js';
import { AuthService } from '../auth/auth.service.js';
import { AuthSettings } from '../auth/settings.js';
import { SessionStore } from '../auth/session-store.js';
import { LoginBudget } from '../auth/login-budget.js';
import { DatabaseService } from '../database/database.service.js';
import { LocalPolicyService } from '../policy/local-policy.service.js';
import { LocalRequestGuard } from '../policy/local-request.guard.js';
import { requestContext, type LocalRequest } from '../policy/request-context.js';
import { ApiErrorFilter } from '../transport/api-error.filter.js';
import { machineAuthFixture } from './machine-auth.integration.fixture.js';
import { MACHINE_HANDLER_METADATA, MachineHandler } from './machine-handler.js';
import { machineAuthProviders, MachineRequestGuard } from './machine-request.guard.js';
import { MachineIngressSettings } from './machine-ingress.settings.js';
import { enrollmentContext, machineContext, type MachineRequest } from './machine-request.js';

@Controller('api/agent-registration')
export class MachineFixtureController {
  @Post('enroll') @MachineHandler('enrollment.consume', 'enrollment')
  enroll(@Req() request: MachineRequest) {
    const context = enrollmentContext(request); return { kind: context.kind, enrollmentId: context.enrollmentId };
  }
  @Post('session') @MachineHandler('session.open', 'machine')
  session(@Req() request: MachineRequest) {
    const context = machineContext(request); return { kind: context.kind, agentId: context.agentId,
      actorId: context.actorId, workspaceId: context.workspaceId, requestId: context.requestId };
  }
  @Post('heartbeat') @MachineHandler('heartbeat.write', 'machine')
  heartbeat(@Req() request: MachineRequest) { return this.session(request); }
  @Get('session') @MachineHandler('session.open', 'machine')
  wrongVerb(@Req() request: MachineRequest) { return this.session(request); }
  @Post('wrong-path') @MachineHandler('session.open', 'machine')
  wrongPath(@Req() request: MachineRequest) { return this.session(request); }
  @Post('sibling') sibling(@Req() request: LocalRequest) { return { kind: requestContext(request).source }; }
}

@Controller('api/agent-registration')
@SetMetadata(MACHINE_HANDLER_METADATA, { capability: 'session.open', authMode: 'machine' })
class ClassOnlyFixtureController {
  @Post('class-only') method(@Req() request: LocalRequest) { return { kind: requestContext(request).source }; }
}
@Controller('api/machine-auth-fixture-human')
class HumanFixtureController {
  constructor(@Inject(LocalPolicyService) private readonly policy: LocalPolicyService) {}
  @Get() get(@Req() request: LocalRequest) { this.policy.authorize(requestContext(request), 'project.read'); return { human: true }; }
  @Post() post(@Req() request: LocalRequest) { this.policy.authorize(requestContext(request), 'project.register'); return { human: true }; }
}
@Injectable()
class FixtureBoundaryGuard implements CanActivate {
  constructor(@Inject(MachineRequestGuard) private readonly machine: MachineRequestGuard,
    @Inject(LocalRequestGuard) private readonly human: LocalRequestGuard) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    return (await this.machine.tryAuthenticate(context)) ?? this.human.canActivate(context);
  }
}
@Module({ controllers: [AuthController, MachineFixtureController, ClassOnlyFixtureController, HumanFixtureController],
  providers: [...machineAuthProviders, LocalRequestGuard, AuthService, AuthSettings, SessionStore, LoginBudget, LocalPolicyService,
    { provide: APP_GUARD, useClass: FixtureBoundaryGuard }, { provide: APP_FILTER, useClass: ApiErrorFilter }] })
class MachineFixtureModule {}

/** Real Nest/Prisma authentication boundary; fixture handlers do not consume codes or open sessions. */
export async function machineHttpFixture(settings: MachineIngressSettings) {
  const h = await machineAuthFixture();
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;
  try {
    app = await NestFactory.create({ module: MachineFixtureModule, providers: [
      { provide: DatabaseService, useValue: h.db }, { provide: MachineIngressSettings, useValue: settings },
    ] }, { logger: false, bodyParser: false });
    app.use(json({ limit: '256kb' })); await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const password = randomBytes(24).toString('base64url'); await h.seedAccount('fixture-http-user', password);
    const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-shipkit-local': '1' },
      body: JSON.stringify({ username: 'fixture-http-user', password }) });
    if (!login.ok) throw new Error('Fixture human login failed');
    const cookie = login.headers.get('set-cookie')!.split(';')[0]!;
    const send = (route: string, headers: Record<string, string> = {}, method = 'POST', body = '{}') => fetch(base + route,
      { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(method === 'GET' ? {} : { body }) });
    const raw = (headers: string[], route = '/api/agent-registration/session') => new Promise<{ status: number; text: string }>((resolve, reject) => {
      const request = httpRequest(base + route, { method: 'POST', headers: ['Host', new URL(base).host, 'Content-Type', 'application/json', ...headers] }, response => {
        let text = ''; response.on('data', data => { text += data; if (text.length > 4096) request.destroy(new Error('Fixture response exceeded budget')); });
        response.on('end', () => resolve({ status: response.statusCode!, text })); response.on('error', reject);
      });
      request.on('error', reject); request.setTimeout(5000, () => request.destroy(new Error('Fixture request timeout'))); request.end('{}');
    });
    return { ...h, cookie, send, raw, close: async () => { await app!.close(); await h.dispose(); } };
  } catch (error) { await app?.close(); await h.dispose(); throw error; }
}
