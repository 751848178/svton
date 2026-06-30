/**
 * Devpilot 前端 API 注册表
 *
 * 通过模块增强（Module Augmentation）为 @svton/api-client 提供类型化的字符串路由。
 * API 名称格式：`METHOD:/path`，路径参数用 `:name` 占位。
 *
 * 响应类型对齐后端 @svton/nestjs-http 信封剥离后的业务数据（data 字段）。
 */

// 通用分页结构（后端 PaginatedData）
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 认证域
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role?: string;
}

export interface AuthLoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface AuthLoginInput {
  email: string;
  password: string;
}

export interface AuthRegisterInput extends AuthLoginInput {
  name?: string;
}

// 团队域
export interface Team {
  id: string;
  name: string;
  description: string | null;
  memberCount?: number;
  myRole?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  role: string;
  user: { id: string; email: string; name: string | null; avatar: string | null };
  createdAt: string;
}

export interface TeamDetail extends Team {
  members: TeamMember[];
}

export interface ApiDefinition<TParams = void, TResponse = unknown> {
  params: TParams;
  response: TResponse;
}

/**
 * 模块增强：登记后端路由。
 * 未登记的路由以字符串字面量调用时会落入宽松回退（见 api-client 的宽松入口）。
 */
declare module '@svton/api-client' {
  interface GlobalApiRegistry {
    // 认证
    'POST:/auth/login': ApiDefinition<AuthLoginInput, AuthLoginResponse>;
    'POST:/auth/register': ApiDefinition<AuthRegisterInput, AuthLoginResponse>;
    'GET:/auth/profile': ApiDefinition<void, AuthUser>;

    // 团队
    'GET:/teams': ApiDefinition<void, Team[]>;
    'GET:/teams/:id': ApiDefinition<{ id: string }, TeamDetail>;
    'POST:/teams': ApiDefinition<{ name: string; description?: string }, Team>;
    'PUT:/teams/:id': ApiDefinition<{ id: string; name?: string; description?: string }, Team>;
    'DELETE:/teams/:id': ApiDefinition<{ id: string }, void>;
    'POST:/teams/:id/members': ApiDefinition<{ id: string; email: string; role?: string }, void>;
    'DELETE:/teams/:id/members/:memberId': ApiDefinition<{ id: string; memberId: string }, void>;
    'PUT:/teams/:id/members/:memberId/role': ApiDefinition<
      { id: string; memberId: string; role: string },
      void
    >;
  }
}
