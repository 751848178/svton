import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthorizer } from '../dist/index.mjs';

test('inherits scoped roles and respects matching scope', () => {
  const authz = createAuthorizer({
    roles: {
      team_member: {
        permissions: [{ resource: 'team', action: 'read', scopeTypes: ['team'] }],
      },
      team_admin: {
        inherits: ['team_member'],
        permissions: [{ resource: 'member', action: 'invite', scopeTypes: ['team'] }],
      },
    },
  });

  const subject = {
    roles: [{ role: 'team_admin', scope: { type: 'team', id: 'team_1' } }],
  };

  assert.equal(
    authz.hasRole({
      subject,
      roles: ['team_member'],
      scope: { type: 'team', id: 'team_1' },
    }).allowed,
    true,
  );
  assert.equal(
    authz.can({
      subject,
      permission: 'member:invite',
      scope: { type: 'team', id: 'team_1' },
    }).allowed,
    true,
  );
  assert.equal(
    authz.can({
      subject,
      permission: 'member:invite',
      scope: { type: 'team', id: 'team_2' },
    }).allowed,
    false,
  );
});

test('deny grants override allow grants', () => {
  const authz = createAuthorizer({
    roles: {
      admin: {
        permissions: ['users:read'],
      },
    },
  });

  const decision = authz.can({
    subject: {
      roles: [{ role: 'admin' }],
      permissions: [
        {
          permission: { resource: 'users', action: 'read', effect: 'deny' },
        },
      ],
    },
    permission: 'users:read',
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'denied');
});

test('supports wildcard resource and action matching', () => {
  const authz = createAuthorizer();

  assert.equal(
    authz.can({
      subject: {
        permissions: [{ permission: 'projects:*' }],
      },
      permission: 'projects:update',
    }).allowed,
    true,
  );

  assert.equal(
    authz.can({
      subject: {
        permissions: [{ permission: '*' }],
      },
      permission: 'billing:refund',
    }).allowed,
    true,
  );
});

test('ignores malformed permission grants instead of treating them as wildcard allows', () => {
  const authz = createAuthorizer();

  const decision = authz.can({
    subject: {
      permissions: [
        {
          permission: { foo: 'bar' },
        },
      ],
    },
    permission: 'billing:refund',
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'missing_permission');
});
