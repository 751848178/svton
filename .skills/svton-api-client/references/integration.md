# Integration

## SWR

```typescript
import useSWR from 'swr';

const { data, isLoading, mutate } = useSWR(
  'GET:/users',
  () => api<PaginatedResponse<User>>('GET:/users', { page: 1 })
);
```

## React Query

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';

const { data } = useQuery({
  queryKey: ['users', 1],
  queryFn: () => api('GET:/users', { page: 1 }),
});

const mutation = useMutation({
  mutationFn: (data) => api('POST:/users', data),
  onSuccess: () => {
    queryClient.invalidateQueries(['users']);
  },
});
```

## @svton/service

```typescript
import { api } from '@svton/api-client';

@Service()
class UserService {
  @observable
  user: User | null = null;

  @action
  *loadUser(id: number) {
    this.user = yield* api('GET:/users/:id', { id });
  }
}
```

## Taro

```typescript
import { api, apiAsync } from '@svton/api-client';

// Use apiAsync for Taro.request
const user = await apiAsync<User>('GET:/users/:id', { id: 123 });

// Use api in @svton/service generators
@Service()
class UserService {
  @observable
  user: User | null = null;

  @action
  *loadUser(id: number) {
    this.user = yield* api('GET:/users/:id', { id });
  }
}

// Or implement apiAsync wrapper in your project
// that uses Taro.request internally
```

## Taro apiAsync Example

```typescript
// lib/api-client.ts
import Taro from '@tarojs/taro';
import { api } from '@svton/api-client';

export async function apiAsync<T>(
  key: string,
  params?: Record<string, any>
): Promise<T> {
  const [method, pathTemplate] = key.split(':') as [string, string];

  let path = pathTemplate;
  const queryParams: Record<string, any> = {};

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (path.includes(`:${key}`)) {
        path = path.replace(`:${key}`, String(value));
      } else {
        queryParams[key] = value;
      }
    });
  }

  const response = await Taro.request({
    url: `${BASE_URL}${path}`,
    method: method as any,
    data: method === 'GET' ? undefined : queryParams,
    header: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  if (response.data.code !== 0) {
    throw new Error(response.data.message);
  }

  return response.data.data;
}
```
