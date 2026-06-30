/**
 * Git 集成域类型
 *
 * 单一职责：仅声明接口。
 */

export type GitProvider = 'github' | 'gitlab' | 'gitee';

export interface GitConnection {
  provider: string;
  username: string;
  connectedAt: string;
}

export interface GitRepo {
  id: string;
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  htmlUrl: string;
}

export interface GitConnectInput {
  provider: GitProvider;
  accessToken: string;
}
