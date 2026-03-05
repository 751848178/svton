# Frontend Development

## @svton/service - State Management

### Decorators

All decorators use `@Decorator()` syntax:

```typescript
@Service({ name: 'user' })  // Optional name
class UserService {
  @observable()
  user: User | null = null;

  @observable()
  count = 0;

  @computed()
  get doubled() {
    return this.count * 2;
  }

  @action()
  increment() {
    this.count++;
  }

  @Inject()
  private authService!: AuthService;
}
```

### Hooks

```typescript
const service = useUserService();

// Subscribe to state
const count = service.useState.count();

// Subscribe to computed
const doubled = service.useDerived.doubled();

// Get action
const increment = service.useAction.increment();

// With auto loading (for @action async methods)
const [increment, loading] = service.useAction.increment.withLoading();
```

### Loading State Management

**DO NOT declare `@observable loading = false;`** - Use `withLoading()`:

```typescript
// ❌ Don't do this
@observable()
loading = false;

@action()
async submit() {
  this.loading = true;
  try {
    await api('POST:/submit', data);
  } finally {
    this.loading = false;
  }
}

// ✅ Use withLoading instead
@action()
async submit() {
  await api('POST:/submit', data);
}

// Component
const [submit, loading] = service.useAction.submit.withLoading();
```

`withLoading()` works with `@action async` methods and automatically manages loading state.

### Generator Actions (Silent Abort)

```typescript
@Service()
class UserService {
  @observable()
  user: User | null = null;
  @observable()
  posts: Post[] = [];

  @action()
  *loadUserData(id: number) {
    // If this fails, generator silently stops
    const user = yield* api('GET:/users/:id', { id });
    this.user = user;

    // Only runs if above succeeded
    const posts = yield* api('GET:/users/:id/posts', { id });
    this.posts = posts;
  }
}
```

### catchError

```typescript
@action()
*loadData(id: number) {
  // Must succeed - aborts if fails
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
```

## @svton/api-client

### Define API

```typescript
import { defineApi } from '@svton/api-client';
import type { UserVo, CreateUserDto } from '@svton/types';

export const getUser = defineApi<{ id: number }, UserVo>(
  'GET', '/users/:id'
);

export const createUser = defineApi<CreateUserDto, UserVo>(
  'POST', '/users'
);
```

### Use API

```typescript
import { api, catchError } from '@svton/api-client';

// Simple call
const user = await api('GET:/users/:id', { id: 123 });

// With catchError
const result = await catchError(api('GET:/users/:id', { id: 123 }));

if (result.hasError) {
  // Handle error
} else {
  // Use result.data
}
```

### Taro Integration

```typescript
import { api, apiAsync } from '@svton/api-client';

// Use apiAsync for Taro.request
const user = await apiAsync<User>('GET:/users/:id', { id: 123 });

// Use api in @svton/service generators
@action()
*loadUser(id: number) {
  this.user = yield* api('GET:/users/:id', { id });
}
```

## @svton/hooks

```typescript
// Function memoization
const memoized = usePersistFn(() => { /* ... */ });

// Debounce
const debounced = useDebounceFn(fn, 300);

// State helpers
const [value, toggle] = useToggle(false);
const [count, { inc, dec }] = useSetState({ count: 0 });

// Storage
const [token, setToken] = useLocalStorage('token', '');
```

## @svton/ui (Next.js) & @svton/taro-ui (Taro)

```typescript
// Request boundary
<RequestBoundary
  loading={loading}
  error={error}
  empty={data.length === 0}
  onRetry={refetch}
>
  {/* Content */}
</RequestBoundary>

// Modal
<Modal
  visible={visible}
  title="Confirm"
  actions={[
    { text: 'Cancel', type: 'cancel', onClick: onClose },
    { text: 'OK', type: 'confirm', onClick: onOk },
  ]}
/>
```

### Taro Specific

```typescript
// Every page needs StatusBar and NavBar
<View>
  <StatusBar />
  <NavBar title="Page Title" />
  {/* Content */}
</View>
```
