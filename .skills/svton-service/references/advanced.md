# Advanced Patterns

## Dependency Injection

```typescript
@Service()
class OrderService {
  @Inject()
  private userService!: UserService;
  @Inject()
  private cartService!: CartService;

  @action()
  *createOrder() {
    const user = this.userService.user;
    const items = this.cartService.items;

    const order = yield* api('POST:/orders', { userId: user.id, items });
    this.order = order;
  }
}
```

## Named Services

```typescript
@Service({ name: 'admin' })
class AdminService {}

@Service({ name: 'user' })
class UserService {}
```

## Service Options

```typescript
@Service({ name: 'user', singleton: true })
class UserService {}
```

## Computed Properties

```typescript
@computed()
get filteredItems() {
  return this.items.filter(item => item.active);
}

@computed()
get stats() {
  return {
    total: this.items.length,
    active: this.items.filter(i => i.active).length,
  };
}
```
