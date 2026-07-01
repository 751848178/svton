# File Responsibilities

每个文件后缀只承载一种职责。下表是「只允许做什么」与「禁止做什么」的详细对照，用于拆分时判断代码该归到哪个文件，以及发现越界时该怎么归位。

## 后端 (TypeScript / NestJS 风格)

### `*.controller.ts`
- **只做：** 接收 HTTP 请求入口、参数校验（dto + validation）、权限装饰器入口、调用 service、把结果封装成响应。
- **禁止：** 写业务规则（if 用户是 VIP 则折扣…）、直接调用 repository / 数据库、做格式转换的复杂逻辑。
- **越界信号：** controller 里出现业务判断分支；controller 直接 `await repo.save(...)`；controller 里组装复杂返回对象。

### `*.service.ts`
- **只做：** 业务规则、流程编排（调多个 repository / 其他 service）、状态变化、事务边界。
- **禁止：** 处理 transport 细节（HTTP 状态码、req/res 对象）、直接写 SQL / query builder 细节、返回给前端的视图格式化。
- **越界信号：** service 里出现 `@Req()` / `res.status()`；service 里拼装前端专用的驼峰/蛇形字段；service 内嵌大段 ORM 链式调用。

### `*.repository.ts`
- **只做：** 数据读写——DB 查询、缓存读写、外部存储交互。把存储细节（表名、ORM 语法、缓存 key 规则）关在这里。
- **禁止：** 业务规则判断（if 余额不足…）、流程编排、跨实体的业务决策。
- **越界信号：** repository 里出现业务条件分支；repository 决定「该不该」存而不只是「怎么」存。

### `*.dto.ts`
- **只做：** 定义**输入**结构——请求体、查询参数、命令对象的形状与校验规则。
- **禁止：** 定义输出结构（那是 vo 的事）、包含业务方法、与持久化实体耦合。
- **越界信号：** dto 里混了响应字段；dto 直接复用 ORM entity（应单独定义 entity 或 vo）。

### `*.vo.ts` / `*.view.ts`
- **只做：** 定义**输出**结构——响应体、视图模型的形状与序列化。
- **禁止：** 定义输入结构、包含业务逻辑。
- **越界信号：** 一个结构同时被用作请求体和响应体（除非真的是同一个，否则分开）。

### `*.types.ts`
- **只做：** 类型别名、枚举、接口定义、联合类型等纯类型声明。
- **禁止：** 任何运行时逻辑、可变值、副作用。

### `*.constants.ts`
- **只做：** 常量值（配置键、状态码、枚举映射、魔法数字的具名化）。
- **禁止：** 函数逻辑（即使是纯函数也归 utils）、可变状态。

### `*.utils.ts`
- **只做：** 无业务状态、无副作用的纯工具函数（格式化、日期计算、字符串处理、通用转换）。
- **禁止：** 业务规则、状态、依赖业务上下文的判断。
- **判断标准：** 把这个函数搬到另一个项目还能用，它就是 utils；搬过去就没意义了，它其实是业务逻辑，应该进 service。

## 前端 (React / TypeScript)

### `*.hooks.ts`
- **只做：** 数据请求、状态管理、副作用编排、派生状态计算。把「怎么拿数据 / 怎么算」交给 hook，让组件只拿结果。
- **禁止：** UI 展示、JSX、样式。
- **越界信号：** hook 里返回 JSX；hook 里混了展示分支。

### `*.component.tsx` / React 组件
- **只做：** UI 展示和用户交互——渲染、事件回调、布局。
- **禁止：** 复杂业务规则（折扣计算、权限判定应下沉到 hook 或 service）、直接调用底层 API / fetch（应经 hook）、跨请求状态持有。
- **越界信号：** 组件里直接 `fetch(...)`；组件里出现「试 A 失败试 B」的降级逻辑；组件持有大量派生 state。

## 常见反模式与归位

| 反模式 | 该归到哪 |
|---|---|
| Controller 里 `if (user.role === 'admin')` 业务分支 | service.ts |
| Service 里 `res.status(400).json(...)` | controller.ts（service 只抛异常或返回结果） |
| Service 里大段 ORM query 细节 | repository.ts |
| dto 里带响应字段 | 拆成 dto（输入）+ vo（输出） |
| 组件里 `fetch('/api/...')` | hooks.ts |
| 组件里 `if (data.status === 'FAILED') calcRetry(...)` | hooks.ts 或 service |
| `helper.ts` 里既格式化日期又算折扣 | 日期→utils.ts，折扣→service.ts，删除 helper.ts |
| `common.ts` 塞了几十个不相关函数 | 按职责拆成多个具体命名的文件 |

## 判断「这是 utils 还是 service」的快速测试

> 把这个函数原样搬到另一个不相关的项目，它还有意义吗？
>
> - **有意义** → `utils.ts`（纯工具）。
> - **没意义**（依赖当前业务的实体、字段、规则）→ `service.ts`。

这是区分「工具」和「业务」最有效的单一判据。
