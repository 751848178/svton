import test from 'node:test';
import assert from 'node:assert/strict';

import 'reflect-metadata';

import { APP_GUARD, Reflector } from '@nestjs/core';

import {
  AuthzGuard,
  AuthzModule,
  PERMISSIONS_KEY,
  ROLES_KEY,
  RolesGuard,
} from '../dist/index.mjs';

function createContext(request, handler, controllerClass) {
  return {
    getHandler: () => handler,
    getClass: () => controllerClass,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  };
}

test('exports AuthzGuard as an alias of RolesGuard', () => {
  assert.equal(AuthzGuard, RolesGuard);
});

test('forRootAsync global guard provider follows resolved enableGlobalGuard', async () => {
  const dynamicModule = AuthzModule.forRootAsync({
    useFactory: async () => ({ enableGlobalGuard: true }),
  });

  const appGuardProvider = dynamicModule.providers.find(
    (provider) => provider && typeof provider === 'object' && provider.provide === APP_GUARD,
  );

  assert.ok(appGuardProvider);
  assert.equal(typeof appGuardProvider.useFactory, 'function');

  const rolesGuard = { canActivate: () => false };

  assert.equal(
    appGuardProvider.useFactory({ enableGlobalGuard: true }, rolesGuard),
    rolesGuard,
  );

  const passThroughGuard = appGuardProvider.useFactory(
    { enableGlobalGuard: false },
    rolesGuard,
  );

  assert.notEqual(passThroughGuard, rolesGuard);
  assert.equal(passThroughGuard.canActivate(), true);
});

test('RolesGuard resolves scoped permissions from inherited roles', async () => {
  class TeamController {}

  const handler = function inviteMember() {};
  Reflect.defineMetadata(
    PERMISSIONS_KEY,
    [{ resource: 'member', action: 'invite' }],
    handler,
  );

  const guard = new RolesGuard(new Reflector(), {
    schema: {
      roles: {
        team_member: {
          permissions: [{ resource: 'team', action: 'read', scopeTypes: ['team'] }],
        },
        team_admin: {
          inherits: ['team_member'],
          permissions: [{ resource: 'member', action: 'invite', scopeTypes: ['team'] }],
        },
      },
    },
    getScope: (context) => ({
      type: 'team',
      id: context.switchToHttp().getRequest().params.teamId,
    }),
  });

  const context = createContext(
    {
      params: { teamId: 'team_1' },
      user: {
        roles: [{ role: 'team_admin', scope: { type: 'team', id: 'team_1' } }],
      },
    },
    handler,
    TeamController,
  );

  assert.equal(await guard.canActivate(context), true);
});

test('RolesGuard lets explicit deny permissions override role grants', async () => {
  class TeamController {}

  const handler = function inviteMember() {};
  Reflect.defineMetadata(
    PERMISSIONS_KEY,
    [{ resource: 'member', action: 'invite' }],
    handler,
  );

  const guard = new RolesGuard(new Reflector(), {
    schema: {
      roles: {
        team_admin: {
          permissions: [{ resource: 'member', action: 'invite', scopeTypes: ['team'] }],
        },
      },
    },
    getScope: (context) => ({
      type: 'team',
      id: context.switchToHttp().getRequest().params.teamId,
    }),
  });

  const context = createContext(
    {
      params: { teamId: 'team_1' },
      user: {
        roles: [{ role: 'team_admin', scope: { type: 'team', id: 'team_1' } }],
        permissions: [
          {
            permission: { resource: 'member', action: 'invite', effect: 'deny' },
            scope: { type: 'team', id: 'team_1' },
          },
        ],
      },
    },
    handler,
    TeamController,
  );

  await assert.rejects(
    () => guard.canActivate(context),
    (error) => error?.message === 'Access denied by authorization policy',
  );
});

test('RolesGuard does not authorize malformed permission payloads', async () => {
  class BillingController {}

  const handler = function refund() {};
  Reflect.defineMetadata(PERMISSIONS_KEY, ['billing:refund'], handler);

  const guard = new RolesGuard(new Reflector(), {});

  const context = createContext(
    {
      user: {
        permissions: [
          {
            permission: { foo: 'bar' },
          },
        ],
      },
    },
    handler,
    BillingController,
  );

  await assert.rejects(
    () => guard.canActivate(context),
    (error) => error?.message === 'Access denied. Missing required permissions',
  );
});

test('RolesGuard supports async assignment and scope resolvers', async () => {
  class TeamController {}

  const handler = function updateTeamConfig() {};
  Reflect.defineMetadata(ROLES_KEY, ['team_admin'], handler);

  const guard = new RolesGuard(new Reflector(), {
    schema: {
      roles: {
        team_member: {},
        team_admin: {
          inherits: ['team_member'],
        },
      },
    },
    getAssignments: async (context) => {
      const request = context.switchToHttp().getRequest();
      request.teamId = request.headers['x-team-id'];
      return {
        roles: [
          {
            role: 'team_admin',
            scope: { type: 'team', id: request.teamId },
          },
        ],
      };
    },
    getScope: async (context) => ({
      type: 'team',
      id: context.switchToHttp().getRequest().teamId,
    }),
  });

  const context = createContext(
    {
      headers: { 'x-team-id': 'team_1' },
      user: { id: 'user_1' },
    },
    handler,
    TeamController,
  );

  assert.equal(await guard.canActivate(context), true);
});
