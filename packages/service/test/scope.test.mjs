import test from 'node:test';
import assert from 'node:assert/strict';

import React from 'react';
import TestRenderer from 'react-test-renderer';

import {
  Service,
  Inject,
  observable,
  computed,
  createService,
  createServiceProvider,
  container,
} from '../dist/index.mjs';

const { act } = TestRenderer;

function defineServices() {
  let authInstanceCounter = 0;
  let todoInstanceCounter = 0;

  class AuthService {
    instanceId = ++authInstanceCounter;
  }

  Service()(AuthService);
  observable()(AuthService.prototype, 'instanceId');

  class TodoService {
    localId = ++todoInstanceCounter;
    authService;

    get authInstanceId() {
      return this.authService.instanceId;
    }
  }

  Service()(TodoService);
  Inject(AuthService)(TodoService.prototype, 'authService');
  observable()(TodoService.prototype, 'localId');
  computed()(
    TodoService.prototype,
    'authInstanceId',
    Object.getOwnPropertyDescriptor(TodoService.prototype, 'authInstanceId'),
  );

  return { AuthService, TodoService };
}

async function render(element) {
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}

test.afterEach(() => {
  container.clear();
});

test('nested providers reuse parent dependencies inside the provider scope tree', async () => {
  const { AuthService, TodoService } = defineServices();
  const AuthProvider = createServiceProvider(AuthService);
  const TodoProvider = createServiceProvider(TodoService);
  const result = {};

  function Consumer() {
    const auth = AuthProvider.useService();
    const todo = TodoProvider.useService();

    result.authId = auth.useState.instanceId();
    result.todoAuthId = todo.useDerived.authInstanceId();
    result.todoLocalId = todo.useState.localId();
    return null;
  }

  const renderer = await render(
    React.createElement(
      AuthProvider,
      null,
      React.createElement(
        TodoProvider,
        null,
        React.createElement(Consumer),
      ),
    ),
  );

  assert.equal(result.authId, result.todoAuthId);
  assert.equal(result.todoLocalId, 1);

  await act(async () => {
    renderer.unmount();
  });
});

test('scoped hooks create an isolated dependency tree even inside a provider subtree', async () => {
  const { AuthService, TodoService } = defineServices();
  const AuthProvider = createServiceProvider(AuthService);
  const useTodoService = createService(TodoService);
  const result = {};

  function Consumer() {
    const auth = AuthProvider.useService();
    const todo = useTodoService();

    result.authId = auth.useState.instanceId();
    result.todoAuthId = todo.useDerived.authInstanceId();
    return null;
  }

  const renderer = await render(
    React.createElement(
      AuthProvider,
      null,
      React.createElement(Consumer),
    ),
  );

  assert.notEqual(result.authId, result.todoAuthId);

  await act(async () => {
    renderer.unmount();
  });
});

test('separate scoped hook consumers do not share service instances', async () => {
  const { TodoService } = defineServices();
  const useTodoService = createService(TodoService);
  const authIds = [];

  function Consumer() {
    const todo = useTodoService();
    authIds.push(todo.useDerived.authInstanceId());
    return null;
  }

  const renderer = await render(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(Consumer),
      React.createElement(Consumer),
    ),
  );

  assert.equal(authIds.length, 2);
  assert.notEqual(authIds[0], authIds[1]);

  await act(async () => {
    renderer.unmount();
  });
});
