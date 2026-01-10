/**
 * 缓存策略接口
 */
export interface CacheStrategy {
  /**
   * 获取缓存值
   */
  get<T>(key: string): Promise<T | undefined>;

  /**
   * 设置缓存值
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 过期时间（秒）
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * 删除缓存
   */
  delete(key: string): Promise<void>;

  /**
   * 清空所有缓存
   */
  clear(): Promise<void>;

  /**
   * 检查缓存是否存在
   */
  has(key: string): Promise<boolean>;

  /**
   * 批量获取
   */
  mget<T>(keys: string[]): Promise<(T | undefined)[]>;

  /**
   * 批量设置
   */
  mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void>;
}

/**
 * Redis 客户端接口（抽象，不绑定具体实现）
 */
export interface RedisClientInterface {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<any>;
  setex(key: string, seconds: number, value: string): Promise<any>;
  del(key: string | string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  mget(...keys: string[]): Promise<(string | null)[]>;
  pipeline(): RedisPipeline;
}

export interface RedisPipeline {
  setex(key: string, seconds: number, value: string): this;
  exec(): Promise<any>;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 缓存键前缀 */
  prefix?: string;
  /** 默认过期时间（秒） */
  defaultTtl?: number;
}
