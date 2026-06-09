---
name: svton-service
description: Provides @svton/service usage guide - React state management with decorators, generator actions, silent abort, and auto loading. Use when writing services, managing state, or handling async operations.
---

# @svton/service

React state management using class decorators with dependency injection support.

## Core Decorators

```typescript
@Service()
class UserService {
  @observable()
  user: User | null = null;

  @computed()
  get isLoggedIn() { return !!this.user; }

  @action()
  async login(username: string, password: string) {
    const user = await api('POST:/auth/login', { username, password });
    this.user = user;
  }

  @Inject()
  private authService!: AuthService;
}
```

**DO NOT declare `@observable loading = false;`** - Use `withLoading()` for auto loading management.

## Hooks

```typescript
const service = useUserService();

// Subscribe to state
const user = service.useState.user();

// Subscribe to computed
const isLoggedIn = service.useDerived.isLoggedIn();

// Get action
const login = service.useAction.login();

// With auto loading (for @action async methods)
const [login, loading] = service.useAction.login.withLoading();
```

## References

- [Generator Actions](references/generators.md) - Silent abort and sequential APIs
- [Provider Pattern](references/provider.md) - Shared instances
- [Advanced Patterns](references/advanced.md) - Dependency injection and tips
