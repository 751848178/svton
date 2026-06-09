---
name: svton-api-client
description: Provides @svton/api-client usage guide - TypeScript API definition with defineApi, path parameter replacement, and error handling. Use when defining APIs, making requests, or integrating with @svton/service.
---

# @svton/api-client

TypeScript-first API client with module definitions and interceptors support.

## Define API

```typescript
// modules/user/index.ts
import { defineApi } from '@svton/api-client';

export const getUser = defineApi<{ id: number }, User>(
  'GET', '/users/:id'
);

export const createUser = defineApi<CreateUserDto, User>(
  'POST', '/users'
);
```

## Use API

```typescript
import { api, catchError } from '@svton/api-client';

// Simple call
const user = await api('GET:/users/:id', { id: 123 });

// With error handling
const result = await catchError(api('GET:/users/:id', { id: 123 }));

if (result.hasError) {
  console.error(result.error);
} else {
  console.log(result.data);
}
```

## Taro Integration

```typescript
import { api, apiAsync } from '@svton/api-client';

// apiAsync for Taro.request
const user = await apiAsync<User>('GET:/users/:id', { id: 123 });

// api for @svton/service generators
@action
*loadUser(id: number) {
  const user = yield* api('GET:/users/:id', { id });
  this.user = user;
}
```

## References

- [API Definition](references/definition.md) - Define patterns and conventions
- [Error Handling](references/error-handling.md) - catchError and silent abort
- [Integration](references/integration.md) - SWR, React Query, and @svton/service
