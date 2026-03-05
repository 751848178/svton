# Best Practices

## Frontend

### Decorator Syntax

All decorators use `@Decorator()` syntax:

```typescript
// ✅ Good: Decorator syntax
@Service()
class UserService {
  @observable()
  count = 0;
  @computed()
  get doubled() { return this.count * 2; }
  @action()
  increment() { this.count++; }
  @Inject()
  private authService!: AuthService;
}
```

### Service Organization

```typescript
// ✅ Good: Single responsibility
@Service()
class AuthService { /* auth only */ }
@Service()
class UserService { /* user only */ }
@Service()
class CartService { /* cart only */ }

// ❌ Bad: Everything in one service
@Service()
class AppService {
  @observable()
  user: User;
  @observable()
  cart: Cart;
  @observable()
  posts: Post[];
  // ... mixed responsibilities
}
```

### Loading State Management

**DO NOT declare `@observable loading = false;`** - Use `withLoading()`:

```typescript
// ❌ Don't do this
@observable()
loading = false;

// ✅ Use withLoading instead
const [submit, loading] = service.useAction.submit.withLoading();
```

### Use Computed Over Selectors

```typescript
// ✅ Good: Computed
@computed()
get filteredItems() {
  return this.items.filter(item => item.active);
}

// ❌ Bad: Create selector
const useFilteredItems = (service) =>
  service.useState.items().filter(item => item.active);
```

### Generator Actions for Sequential APIs

```typescript
// ✅ Good: Generator with silent abort
@action()
*loadData(id: number) {
  const user = yield* api('GET:/users/:id', { id });
  this.user = user;

  const posts = yield* api('GET:/users/:id/posts', { id });
  this.posts = posts;
}

// ❌ Bad: Try-catch hell
@action()
async loadData(id: number) {
  try {
    const user = await api('GET:/users/:id', { id });
    this.user = user;

    const posts = await api('GET:/users/:id/posts', { id });
    this.posts = posts;
  } catch (error) {
    // ... handle error
  }
}
```

## Backend

### Use Decorators for Caching

```typescript
// ✅ Good: Declarative
@Cacheable({ key: 'user:#id', ttl: 3600 })
async findById(id: number) { /* ... */ }

// ❌ Bad: Imperative
async findById(id: number) {
  const cached = await cache.get(`user:${id}`);
  if (cached) return cached;
  const user = await this.repo.findById(id);
  await cache.set(`user:${id}`, user, 3600);
  return user;
}
```

### Use Module Providers for Shared Services

```typescript
// ✅ Good: Provider pattern
@Module({
  providers: [{
    provide: 'REDIS_OPTIONS',
    useFactory: (config) => ({ /* ... */ }),
    inject: [ConfigService],
  }],
})
export class AppModule {}

// ❌ Bad: Direct import
@Module({
  providers: [RedisService], // Hard to test/mock
})
```

### Environment Variables

```typescript
// ✅ Good: Use ConfigService
RedisModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    host: config.get('REDIS_HOST'),
    port: config.get<number>('REDIS_PORT'),
  }),
})

// ❌ Bad: Direct env access
RedisModule.forRoot({
  host: process.env.REDIS_HOST,  // No type safety
  port: parseInt(process.env.REDIS_PORT || '6379'),
})
```

## Common Patterns

### Error Handling

```typescript
// Frontend
@action()
*loadData() {
  const result = yield* catchError(api('GET:/data'));

  if (result.error) {
    this.error = result.error.message;
  } else {
    this.data = result.data;
  }
}

// Backend
@Catch(HttpException)
async handleException(exception: HttpException) {
  return {
    code: exception.getStatus(),
    message: exception.message,
  };
}
```

### Pagination

```typescript
// API definition
export const getUserList = defineApi<
  { page: number; size: number },
  PaginatedResponse<UserVo>
>('GET', '/users');

// Component
const { data, isLoading } = useQuery(
  'GET:/users',
  { page: 1, size: 20 }
);

// Backend
@Get()
async findAll(@Query() dto: PaginationDto) {
  return this.userService.paginate(dto);
}
```

## File Naming

```
services/
  user.service.ts          # ✅ PascalCase + .service.ts
  auth.service.ts

components/
  UserProfile.tsx         # ✅ PascalCase
  user-profile.tsx        # ✅ kebab-case (alternative)

modules/
  user/
    index.ts
    user.module.ts         # ✅ domain-name.module.ts
    user.controller.ts
```
