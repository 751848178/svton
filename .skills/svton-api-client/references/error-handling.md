# Error Handling

## catchError

```typescript
import { catchError } from '@svton/api-client';

// Basic
const result = await catchError(api('GET:/users/:id', { id: 123 }));

if (result.hasError) {
  console.error('Failed:', result.error);
} else {
  console.log('Success:', result.data);
}

// Destructured
const { data, error, hasError } = await catchError(
  api('GET:/users/:id', { id: 123 })
);
```

## Return Type

```typescript
interface CatchErrorResult<T> {
  data?: T;          // Success data
  error?: Error;     // Error object
  hasError: boolean; // Whether error occurred
}
```

## With @svton/service

```typescript
@Service()
class DataService {
  @observable user: User | null = null;
  @observable avatar: string | null = null;

  @action
  *loadUserData(id: number) {
    // Must succeed - aborts on failure
    const user = yield* api('GET:/users/:id', { id });
    this.user = user;

    // Can fail - won't abort flow
    const result = yield* catchError(api('GET:/users/:id/avatar', { id }));

    if (result.error) {
      this.avatar = '/default.png';
    } else {
      this.avatar = result.data;
    }
  }
}
```

## Silent Abort in Generators

When using `yield* api()` in generators:

```typescript
@action
*loadData(id: number) {
  const user = yield* api('GET:/users/:id', { id });
  // If above fails, execution stops here
  // No try-catch needed
  this.user = user;
}
```
