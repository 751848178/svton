# 迁移指南：v0.3.x → v0.4.0

## 概述

v0.4.0 版本改进了 TypeScript 类型系统，提供更好的类型推断和 IDE 支持。主要变化是移除了可选链的需求。

## 改进内容

### 类型推断增强

**改进**: 所有属性都从 Service 类直接推断，无需使用可选链。

**迁移步骤**:

#### 移除可选链（如果之前使用了）

```typescript
// ❌ v0.3.x（如果使用了可选链）
const doubled = service.useDerived.doubled?.();

// ✅ v0.4.0
const doubled = service.useDerived.doubled();
```

#### 移除非空断言

```typescript
// ❌ v0.3.x
const doubled = service.useDerived.doubled!();

// ✅ v0.4.0
const doubled = service.useDerived.doubled();
```

#### 移除默认值（如果不需要）

```typescript
// ❌ v0.3.x
const doubled = service.useDerived.doubled?.() ?? 0;

// ✅ v0.4.0（如果 doubled 不会是 undefined）
const doubled = service.useDerived.doubled();

// ✅ v0.4.0（如果需要处理异常情况）
const doubled = service.useDerived.doubled() ?? 0;
```

## 自动迁移

使用以下正则表达式批量替换：

### VS Code / WebStorm

1. 打开查找替换（Cmd/Ctrl + Shift + H）
2. 启用正则表达式模式
3. 查找：`\.useDerived\.(\w+)\?\.\(\)`
4. 替换：`.useDerived.$1()`

### 命令行（macOS/Linux）

```bash
# 预览变更
find src -name "*.tsx" -o -name "*.ts" | xargs grep -l "useDerived\." | \
  xargs sed -n 's/\.useDerived\.\([a-zA-Z_][a-zA-Z0-9_]*\)?\.(/\.useDerived\.\1(/gp'

# 执行替换
find src -name "*.tsx" -o -name "*.ts" | xargs grep -l "useDerived\." | \
  xargs sed -i '' 's/\.useDerived\.\([a-zA-Z_][a-zA-Z0-9_]*\)?\.(/\.useDerived\.\1(/g'
```

## 示例迁移

### 简单组件

```typescript
// ❌ v0.3.x
function Counter() {
  const service = useCounterService();
  const doubled = service.useDerived.doubled?.();
  return <div>{doubled}</div>;
}

// ✅ v0.4.0
function Counter() {
  const service = useCounterService();
  const doubled = service.useDerived.doubled();
  return <div>{doubled}</div>;
}
```

### 列表组件

```typescript
// ❌ v0.3.x
function TodoList() {
  const service = useTodoService();
  const todos = service.useDerived.filteredTodos?.() ?? [];
  return <ul>{todos.map(/* ... */)}</ul>;
}

// ✅ v0.4.0
function TodoList() {
  const service = useTodoService();
  const todos = service.useDerived.filteredTodos();
  return <ul>{todos.map(/* ... */)}</ul>;
}
```

### 复杂对象

```typescript
// ❌ v0.3.x
function Stats() {
  const service = useTodoService();
  const stats = service.useDerived.stats?.() ?? { total: 0, active: 0, completed: 0 };
  return (
    <div>
      <span>Total: {stats.total}</span>
      <span>Active: {stats.active}</span>
    </div>
  );
}

// ✅ v0.4.0
function Stats() {
  const service = useTodoService();
  const stats = service.useDerived.stats();
  return (
    <div>
      <span>Total: {stats.total}</span>
      <span>Active: {stats.active}</span>
    </div>
  );
}
```

### 条件渲染

```typescript
// ❌ v0.3.x
function UserInfo() {
  const service = useUserService();
  const isLoggedIn = service.useDerived.isLoggedIn?.() ?? false;
  return isLoggedIn ? <Profile /> : <Login />;
}

// ✅ v0.4.0
function UserInfo() {
  const service = useUserService();
  const isLoggedIn = service.useDerived.isLoggedIn();
  return isLoggedIn ? <Profile /> : <Login />;
}
```

## 不受影响的 API

以下 API 没有变化，无需修改：

### useState

```typescript
// ✅ 无需修改
const count = service.useState.count();
const user = service.useState.user();
```

### useAction

```typescript
// ✅ 无需修改
const increment = service.useAction.increment();
const login = service.useAction.login();
```

### 装饰器

```typescript
// ✅ 无需修改
@Service()
class MyService {
  @observable count = 0;
  
  @computed
  get doubled() {
    return this.count * 2;
  }
  
  @action
  increment() {
    this.count++;
  }
}
```

## 类型改进

v0.4.0 提供了更好的类型推断：

```typescript
@Service()
class UserService {
  @observable user: User | null = null;
  @observable count = 0;

  @computed
  get isLoggedIn() {
    return this.user !== null;
  }

  @action
  async login(username: string, password: string) {
    // ...
  }
}

const service = useUserService();

// ✅ 类型自动推断，无需可选链
const user: User | null = service.useState.user();
const count: number = service.useState.count();
const isLoggedIn: boolean = service.useDerived.isLoggedIn();
const login: (username: string, password: string) => Promise<void> = service.useAction.login();
```

## 常见问题

### Q: 为什么要做这个改变？

A: 新的类型系统提供了更精确的类型推断，所有属性都从 Service 类直接映射，支持 Go to Definition，并且不需要使用可选链，代码更简洁。

### Q: 我可以继续使用 v0.3.x 吗？

A: 可以，但建议升级到 v0.4.0 以获得更好的类型支持和 IDE 体验。

### Q: 迁移需要多长时间？

A: 对于大多数项目，使用正则表达式批量替换只需几分钟。

### Q: 有没有自动化工具？

A: 目前没有专门的 codemod 工具，但可以使用上面提供的正则表达式进行批量替换。

### Q: 如果我在错误的地方使用属性会怎样？

A: 运行时会抛出清晰的错误，告诉你应该使用哪个 Hook。例如：
```
Error: Property "doubled" is not decorated with @observable. 
Did you mean to use useDerived.doubled()?
```

## 获取帮助

如果在迁移过程中遇到问题：

1. 查看 [TYPESCRIPT_GUIDE.md](./TYPESCRIPT_GUIDE.md) 了解详细的类型系统说明
2. 查看 [README.md](./README.md) 了解基本用法
3. 提交 Issue 到 GitHub 仓库

## 总结

v0.4.0 的主要变化：
- ✅ 更精确的类型定义
- ✅ 更好的 IDE 支持（Go to Definition）
- ✅ 无需可选链，代码更简洁
- ✅ 运行时验证，错误提示清晰
- ⚠️ 需要移除之前的 `?.()` 可选链（如果有）

迁移步骤：
1. 更新依赖：`pnpm update @svton/service`
2. 批量替换：`.useDerived.xxx?.()` → `.useDerived.xxx()`
3. 测试应用：确保所有功能正常
4. 提交代码：完成迁移
