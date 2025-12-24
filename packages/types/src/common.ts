// ============================================================
// 通用类型定义
// ============================================================

// 分页请求参数
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

// 分页响应
export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 通用 API 响应
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

// ============================================================
// 用户相关类型
// ============================================================

// 用户角色
export type UserRole = 'user' | 'admin' | 'super_admin';

// 用户状态
export type UserStatus = 0 | 1; // 0: 禁用, 1: 启用

// 用户基础信息
export interface UserVo {
  id: number;
  phone: string;
  nickname: string;
  avatar?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

// 用户详情（包含更多字段）
export interface UserDetailVo extends UserVo {
  email?: string;
  bio?: string;
  lastLoginAt?: string;
}

// ============================================================
// 内容相关类型
// ============================================================

// 内容状态
export type ContentStatus = 'draft' | 'pending' | 'published' | 'rejected';

// 内容基础信息
export interface ContentVo {
  id: number;
  title: string;
  content: string;
  images: string[];
  status: ContentStatus;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  author: UserVo;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// 通用工具类型
// ============================================================

// 可选的 ID
export type WithOptionalId<T> = Omit<T, 'id'> & { id?: number };

// 创建 DTO（移除系统字段）
export type CreateDto<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

// 更新 DTO
export type UpdateDto<T> = Partial<CreateDto<T>> & { id: number };
