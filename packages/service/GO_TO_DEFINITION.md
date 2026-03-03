# Go to Definition 支持说明

## 当前状态

由于 TypeScript 映射类型的限制，直接在 `service.useState.xxx()` 上使用 Go to Definition 会跳转到类型定义，而不是原始的 Service 类属性。

## 为什么会这样？

这是 TypeScript Language Server 的设计限制：

```typescript
type StateHooks<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any ? never : K]: () => T[K];
};
```

当你点击 `service.useState.count` 时，TypeScript 会：
1. 识别 `count` 是 `StateHooks<UserService>` 的一个键
2. 跳转到 `StateHooks` 的类型定义
3. **停止**，不会继续追踪到 `UserService.count`

这不是我们的实现问题，而是 TypeScript 的固有限制。即使是 React 的 `useState`、`useRef` 等也有同样的问题。

## 解决方案

### 方案 1：通过 Service 实例访问（推荐）

```typescript
const useUserService = createService(UserService);

function MyComponent() {
  const service = useUserService();
  
  // ✅ 方法 1：先获取 Service 实例的类型引用
  // 在 service 上 Cmd + Click 可以跳转到 UserService
  const count = service.useState.count();
  
  // ✅ 方法 2：直接查看 UserService 类定义
  // 在编辑器中打开 UserService 文件
}
```

### 方案 2：使用类型注解

```typescript
function MyComponent() {
  // ✅ 添加类型注解，可以跳转到 UserService
  const service: ServiceInstance<UserService> = useUserService();
  
  // 现在在 UserService 上 Cmd + Click 可以跳转
  const count = service.useState.count();
}
```

### 方案 3：使用 IDE 的其他功能

大多数 IDE 提供了其他导航功能：

#### VS Code
- **Find All References** (Shift + F12): 查找所有使用该属性的地方
- **Peek Definition** (Alt + F12): 预览定义
- **Go to Type Definition** (Cmd/Ctrl + Click on type): 跳转到类型定义

#### WebStorm / IntelliJ
- **Find Usages** (Alt + F7): 查找使用
- **Go to Declaration** (Cmd + B): 跳转到声明
- **Go to Type Declaration** (Cmd + Shift + B): 跳转到类型声明

### 方案 4：使用注释标记

在 Service 类中添加 JSDoc 注释：

```typescript
@Service()
class UserService {
  /**
   * 用户计数
   * @see UserService.count
   */
  @observable count = 0;
  
  /**
   * 计数的两倍
   * @see UserService.doubled
   */
  @computed
  get doubled() {
    return this.count * 2;
  }
}
```

这样在 hover 时可以看到注释，并通过 `@see` 标签导航。

## 技术背景

### TypeScript 映射类型的限制

TypeScript 的映射类型会创建一个新的类型，而不是保留对原始类型的引用：

```typescript
// 原始类型
class User {
  name: string;
  age: number;
}

// 映射类型
type UserGetters = {
  [K in keyof User]: () => User[K];
};

// 当你点击 UserGetters 中的 name 时
// TypeScript 只知道它是 UserGetters 的一个键
// 不知道它来自 User.name
```

### 为什么不能改进？

这是 TypeScript 类型系统的设计决策：
1. **性能考虑**：保留完整的类型来源信息会显著增加内存使用
2. **类型擦除**：TypeScript 在编译后会擦除类型信息
3. **映射类型的本质**：映射类型创建的是新类型，不是引用

### 其他库的情况

这个问题在整个 TypeScript 生态系统中都存在：

- **React**: `useState`, `useRef` 等 Hooks 也无法直接跳转到原始定义
- **Redux**: `useSelector` 无法跳转到 state 的原始定义
- **MobX**: `observer` 包装的组件无法跳转到原始组件
- **Vue**: `computed` 属性无法跳转到原始定义

## 最佳实践

1. **保持 Service 类简洁**：这样更容易找到定义
2. **使用有意义的命名**：让属性名自解释
3. **添加 JSDoc 注释**：提供额外的上下文
4. **使用 IDE 的搜索功能**：Find All References 比 Go to Definition 更有用
5. **组织好文件结构**：让 Service 类容易找到

## 未来展望

TypeScript 团队正在讨论改进映射类型的导航支持，但这需要对类型系统进行重大改变。

相关 Issue:
- https://github.com/microsoft/TypeScript/issues/12754
- https://github.com/microsoft/TypeScript/issues/47920

## 总结

虽然无法直接 Go to Definition 到原始属性，但这是 TypeScript 的限制，不是我们的实现问题。

我们提供的类型系统已经是在 TypeScript 限制下的最佳实践：
- ✅ 完整的类型推断
- ✅ 类型安全检查
- ✅ 自动补全
- ✅ 类型错误提示
- ⚠️ Go to Definition 有限制（TypeScript 固有问题）

使用上述的替代方案可以有效地导航代码。
