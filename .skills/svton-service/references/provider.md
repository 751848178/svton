# Provider Pattern

Use Provider for shared instances across component tree.

## Create Provider

```typescript
import { createServiceProvider } from '@svton/service';

const { Provider, useService } = createServiceProvider(UserService);
```

## Use in App

```typescript
function App() {
  return (
    <Provider>
      <Main />
    </Provider>
  );
}
```

## Use in Components

```typescript
function UserProfile() {
  const service = useService();
  const user = service.useState.user();
  // ...
}
```

## Multiple Providers

```typescript
const AuthProvider = createServiceProvider(AuthService);
const TodoProvider = createServiceProvider(TodoService);

function App() {
  return (
    <AuthProvider>
      <TodoProvider>
        <Main />
      </TodoProvider>
    </AuthProvider>
  );
}
```
