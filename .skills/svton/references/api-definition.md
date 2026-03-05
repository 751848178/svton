# API Definition

## Define API Module

Create API definition in `packages/api-client/src/modules/{domain}/index.ts`:

```typescript
import { defineApi } from '../../define';
import type { UserVo, CreateUserDto, PaginatedResponse } from '@svton/types';

// List with pagination
export const getUserList = defineApi<
  { page: number; size: number },
  PaginatedResponse<UserVo>
>('GET', '/users');

// Get by ID (path parameter)
export const getUserById = defineApi<
  { id: number },
  UserVo
>('GET', '/users/:id');

// Create
export const createUser = defineApi<
  CreateUserDto,
  UserVo
>('POST', '/users');

// Update
export const updateUser = defineApi<
  { id: number } & Partial<CreateUserDto>,
  UserVo
>('PUT', '/users/:id');

// Delete
export const deleteUser = defineApi<
  { id: number },
  void
>('DELETE', '/users/:id');
```

## Export Module

Add to `packages/api-client/src/modules/index.ts`:

```typescript
export * from './user';
export * from './post';
// ... other modules
```

## Use in Components

### Basic Usage

```typescript
import { api, catchError } from '@svton/api-client';

const user = await api('GET:/users/:id', { id: 123 });

const list = await api('GET:/users', { page: 1, size: 20 });
```

### Error Handling

```typescript
const result = await catchError(api('GET:/users/:id', { id: 123 }));

if (result.hasError) {
  console.error('Failed:', result.error);
} else {
  console.log('Success:', result.data);
}
```

### Generator Action

```typescript
@Service()
class UserService {
  @observable user: User | null = null;
  @observable posts: Post[] = [];
  @observable loading = false;

  @action
  *loadUserData(id: number) {
    this.loading = true;

    // If this fails, generator stops silently
    const user = yield* api('GET:/users/:id', { id });
    this.user = user;

    const posts = yield* api('GET:/users/:id/posts', { id });
    this.posts = posts;

    this.loading = false;
  }
}
```

## Naming Conventions

Use "domain + action" pattern:

```typescript
// Good
getUserList, getUserById, createUser, updateUser, deleteUser
getPostList, getPostDetail, createPost
getCategoryList, getCategoryTree

// Avoid
users.list, users.getById
getUsers, getUser, createUserUser
```

## Path Parameters

Use `:paramName` for path parameters:

```typescript
// API: GET /users/:id/posts/:postId
export const getUserPost = defineApi<
  { id: number; postId: number },
  PostVo
>('GET', '/users/:id/posts/:postId');

// Usage
await api('GET:/users/:id/posts/:postId', { id: 1, postId: 100 });
```
