# Generator Actions

Generator functions provide **silent abort** - if an API request fails, generator stops without throwing errors.

## Basic Usage

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

## catchError

Use `catchError` to handle errors without aborting flow:

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

## Loading State

**DO NOT declare `@observable loading = false;`** - Use `withLoading()`:

```typescript
// ❌ Don't do this
@observable()
loading = false;

// ✅ Use withLoading instead
const [loadUser, loading] = service.useAction.loadUserData.withLoading();
```

The `withLoading()` hook automatically manages loading state without needing explicit `@observable loading`.
