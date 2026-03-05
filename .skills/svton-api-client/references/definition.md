# API Definition

## defineApi

```typescript
import { defineApi } from '@svton/api-client';
import type { UserVo, CreateUserDto, PaginatedResponse } from '@svton/types';

// Basic
export const getUser = defineApi<{ id: number }, User>(
  'GET', '/users/:id'
);

// With pagination
export const getUserList = defineApi<
  { page: number; size: number },
  PaginatedResponse<User>
>('GET', '/users');

// Create
export const createUser = defineApi<CreateUserDto, User>(
  'POST', '/users'
);

// Update
export const updateUser = defineApi<
  { id: number } & Partial<CreateUserDto>,
  User
>('PUT', '/users/:id');

// Delete
export const deleteUser = defineApi<{ id: number }, void>(
  'DELETE', '/users/:id'
);
```

## Naming Conventions

Use "domain + action" pattern:

```typescript
// ✅ Good
getUserList, getUserById, createUser, updateUser, deleteUser
getPostList, getPostDetail, createPost

// ❌ Bad
users.list, users.getById
getUsers, getUser, createUserUser
```

## Path Parameters

```typescript
// API: GET /users/:id/posts/:postId
export const getUserPost = defineApi<
  { id: number; postId: number },
  Post
>('GET', '/users/:id/posts/:postId');

// Usage
await api('GET:/users/:id/posts/:postId', { id: 1, postId: 100 });
```
