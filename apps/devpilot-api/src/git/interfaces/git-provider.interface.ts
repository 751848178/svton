export interface GitUser {
  id: string;
  username: string;
  name: string;
  avatar: string;
  email?: string;
}

export interface GitRepo {
  id: string;
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
}

export interface CreateRepoOptions {
  name: string;
  description?: string;
  private?: boolean;
  autoInit?: boolean;
}

export interface GitProvider {
  readonly name: string;
  
  // 获取用户信息
  getUser(accessToken: string): Promise<GitUser>;
  
  // 获取用户仓库列表
  listRepos(accessToken: string): Promise<GitRepo[]>;
  
  // 创建仓库
  createRepo(accessToken: string, options: CreateRepoOptions): Promise<GitRepo>;
  
  // 推送文件到仓库
  pushFiles(
    accessToken: string,
    repo: string,
    files: { path: string; content: string }[],
    message: string,
    branch?: string,
  ): Promise<void>;
}
