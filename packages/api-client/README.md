# @svton/api-client

TypeScript-first API client with module augmentation, interceptors, and SWR integration.

## Features

- 🎯 **TypeScript-first**: Full type safety with module augmentation
- 🔧 **Path Parameters**: Automatic path parameter replacement (`/users/:id` → `/users/123`)
- 🔄 **Interceptors**: Request, response, and error handling
- 🚀 **Generator Support**: Promise and Generator-based API calls
- ⚡ **SWR Integration**: Built for React with SWR hooks
- 🛡️ **Type Safety**: Compile-time API validation
- 📦 **Modular**: Clean separation of concerns

## Installation

```bash
pnpm add @svton/api-client @svton/types
```

## Quick Start

### 1. Define API Types (in @svton/types)

```typescript
// packages/types/src/apis/auth.ts
import type { ApiDefinition } from '@svton/api-client';

declare module '@svton/api-client' {
  interface GlobalApiRegistry {
    'POST:/auth/login': ApiDefinition<LoginDto, LoginVo>;
    'GET:/auth/me': ApiDefinition<void, UserVo>;
    'GET:/users/:id': ApiDefinition<{ id: number }, UserVo>;
    'PUT:/users/:id': ApiDefinition<{ id: number; data: UpdateUserDto }, UserVo>;
  }
}

interface LoginDto {
  phone: string;
  password: string;
}

interface UserVo {
  id: number;
  name: string;
  email: string;
}
```

### 2. Create API Client

```typescript
// lib/api-client.ts
import { createApiClient, createTokenInterceptor } from '@svton/api-client';
import '@svton/types'; // Enable module augmentation

const axiosAdapter = {
  async request(config: any) {
    const response = await fetch(config.url, {
      method: config.method,
      headers: config.headers,
      body: config.data ? JSON.stringify(config.data) : undefined,
    });
    return response.json();
  }
};

export const { api, apiAsync } = createApiClient(axiosAdapter, {
  baseURL: 'https://api.example.com',
  interceptors: {
    request: [
      createTokenInterceptor(() => localStorage.getItem('token'))
    ]
  }
});
```

### 3. Use in Components

```typescript
// With SWR (recommended)
import { useQuery } from '@/hooks/useAPI';

function UserProfile({ userId }: { userId: number }) {
  const { data: user, error, isLoading } = useQuery('GET:/users/:id', {
    id: userId
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return <div>Welcome, {user.name}!</div>;
}

// Direct API calls
import { apiAsync } from '@/lib/api-client';

async function updateUser(id: number, updates: UpdateUserDto) {
  return await apiAsync('PUT:/users/:id', {
    id,
    data: updates
  });
}
```

## Advanced Usage

### Generator API (Recommended)

```typescript
import { api, runGenerator } from '@/lib/api-client';

function* loadDashboard() {
  // Sequential API calls with type safety
  const user = yield* api('GET:/auth/me');
  const posts = yield* api('GET:/posts', { userId: user.id, limit: 10 });
  const notifications = yield* api('GET:/notifications');
  
  return { user, posts, notifications };
}

// Execute generator
const dashboard = await runGenerator(loadDashboard());
```

### Path Parameters

```typescript
// Automatic path parameter replacement
await apiAsync('GET:/users/:id', { id: 123 });
// → GET /users/123

await apiAsync('PUT:/posts/:postId/comments/:commentId', {
  postId: 456,
  commentId: 789,
  data: { content: 'Updated comment' }
});
// → PUT /posts/456/comments/789
```

### Request/Response Interceptors

```typescript
import { 
  createApiClient, 
  createTokenInterceptor, 
  createUnauthorizedInterceptor,
  createLogInterceptor 
} from '@svton/api-client';

const { api, apiAsync } = createApiClient(adapter, {
  baseURL: 'https://api.example.com',
  interceptors: {
    request: [
      // Add authentication token
      createTokenInterceptor(() => getAuthToken()),
      
      // Log requests in development
      createLogInterceptor('Request')
    ],
    
    response: [
      // Log responses in development
      createLogInterceptor('Response')
    ],
    
    error: [
      // Handle 401 unauthorized
      createUnauthorizedInterceptor(() => {
        localStorage.removeItem('auth-token');
        window.location.href = '/login';
      })
    ]
  }
});
```

## SWR Integration

### useQuery Hook

```typescript
import { useQuery } from '@/hooks/useAPI';

function PostList() {
  const { data, error, isLoading, mutate } = useQuery('GET:/posts', {
    page: 1,
    limit: 20
  });

  // Conditional requests
  const { data: user } = useQuery('GET:/auth/me', 
    isAuthenticated ? {} : null // null = don't fetch
  );

  // Dependent queries
  const { data: profile } = useQuery('GET:/users/:id', 
    user ? { id: user.id } : null
  );

  return (
    <div>
      {isLoading && <div>Loading...</div>}
      {error && <div>Error: {error.message}</div>}
      {data?.items.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
}
```

### useMutation Hook

```typescript
import { useMutation, mutate } from '@/hooks/useAPI';

function CreatePostForm() {
  const { trigger, isMutating } = useMutation('POST:/posts', {
    onSuccess: (newPost) => {
      // Optimistically update cache
      mutate('GET:/posts', (data) => ({
        ...data,
        items: [newPost, ...data.items]
      }));
    }
  });

  const handleSubmit = async (formData) => {
    try {
      await trigger(formData);
    } catch (error) {
      console.error('Failed to create post:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <button disabled={isMutating}>
        {isMutating ? 'Creating...' : 'Create Post'}
      </button>
    </form>
  );
}
```

## Error Handling

```typescript
import { ApiError } from '@svton/api-client';

try {
  const user = await apiAsync('GET:/users/:id', { id: 123 });
} catch (error) {
  if (error instanceof ApiError) {
    console.log('API Error:', error.code, error.message);
    console.log('Status:', error.status);
    console.log('Response:', error.response);
  } else {
    console.log('Network Error:', error.message);
  }
}
```

## Best Practices

1. **Type Safety First**: Always use `@svton/types` for API definitions
2. **Module Augmentation**: Organize APIs by feature modules in separate files
3. **Interceptors**: Use interceptors for cross-cutting concerns (auth, logging, error handling)
4. **Path Parameters**: Prefer path parameters over query parameters for resource identifiers
5. **SWR Integration**: Use `useQuery`/`useMutation` hooks for React components
6. **Generator API**: Use generator functions for complex sequential API calls
7. **Error Boundaries**: Implement proper error handling at component boundaries

## Migration from v0.x

```typescript
// Old approach (v0.x)
import { loginAPI } from '@svton/api-client';
const result = await loginAPI({ phone, password });

// New approach (v1.0)
import { apiAsync } from '@/lib/api-client';
const result = await apiAsync('POST:/auth/login', { phone, password });
```

## TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true
  }
}
```

## License

MIT © SVTON Team
