---
name: svton
description: Provides usage guidelines and best practices for SVTON framework development across frontend (React/Taro) and backend (NestJS). Use when working with SVTON monorepo projects, implementing new features, or using @svton/* packages.
---

# SVTON Framework

SVTON is a full-stack development framework with React/Taro frontend and NestJS backend.

## Quick Start

**Frontend packages**: @svton/service, @svton/api-client, @svton/hooks, @svton/ui, @svton/taro-ui
**Backend packages**: @svton/nestjs-* (redis, cache, queue, authz, oauth, payment, sms, object-storage)

## Core Patterns

### Service Pattern (Frontend)

Use @svton/service for state management:

```typescript
@Service()
class UserService {
  @observable user: User | null = null;
  @observable loading = false;

  @computed get isLoggedIn() { return !!this.user; }

  @action async login(username: string, password: string) {
    this.loading = true;
    // ...
  }
}
```

**Key decorators**: @Service, @observable, @computed, @action, @Inject

### Generator Actions

Use generator functions with `yield* api()` for silent abort on API failure:

```typescript
@action
*loadUserData(id: number) {
  const user = yield* api('GET:/users/:id', { id });
  this.user = user;

  const posts = yield* api('GET:/users/:id/posts', { id });
  this.posts = posts;
}
```

**Error handling**: Use `catchError(api(...))` to capture errors without aborting flow.

### Auto Loading

```typescript
const [login, loading] = service.useAction.login.withLoading();
```

## References

- [Frontend Guidelines](references/frontend.md) - Service, api-client, hooks, UI components
- [Backend Guidelines](references/backend.md) - NestJS modules, decorators, patterns
- [API Definition](references/api-definition.md) - Defining and using API endpoints
- [Best Practices](references/best-practices.md) - Common patterns and conventions
