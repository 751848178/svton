// ============================================================
// API 请求/响应类型定义
// ============================================================

import type { UserVo, UserRole, PaginationParams, ContentStatus } from './common';

// ============================================================
// 认证相关
// ============================================================

// 登录请求
export interface LoginDto {
  phone: string;
  password: string;
}

// 登录响应
export interface LoginVo {
  accessToken: string;
  refreshToken: string;
  user: UserVo;
}

// 注册请求
export interface RegisterDto {
  phone: string;
  password: string;
  nickname: string;
  code?: string; // 验证码
}

// 刷新 Token
export interface RefreshTokenDto {
  refreshToken: string;
}

// ============================================================
// 用户管理
// ============================================================

// 用户列表查询
export interface UserListParams extends PaginationParams {
  keyword?: string;
  role?: UserRole;
  status?: number;
}

// 创建用户
export interface CreateUserDto {
  phone: string;
  password: string;
  nickname: string;
  role?: UserRole;
}

// 更新用户
export interface UpdateUserDto {
  nickname?: string;
  avatar?: string;
  role?: UserRole;
  status?: number;
}

// ============================================================
// 内容管理
// ============================================================

// 内容列表查询
export interface ContentListParams extends PaginationParams {
  keyword?: string;
  status?: ContentStatus;
  authorId?: number;
}

// 创建内容
export interface CreateContentDto {
  title: string;
  content: string;
  images?: string[];
}

// 更新内容
export interface UpdateContentDto {
  title?: string;
  content?: string;
  images?: string[];
  status?: ContentStatus;
}
