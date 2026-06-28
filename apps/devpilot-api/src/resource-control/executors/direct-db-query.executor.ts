import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { createConnection, FieldPacket } from 'mysql2/promise';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ResolvedCredentialRef } from '../credentials/credential-resolver';

type DirectDbResource = {
  id: string;
  sourceType: string;
  provider: string;
  kind: string;
  name: string;
  endpoint: string | null;
  externalId: string;
  serverId: string | null;
  credentialId: string | null;
};

type QueryContract = {
  shape: string;
  columns: Array<{ key: string; label: string; type: string; masked: boolean }>;
  rowLimitDefault: number;
  rowLimitMax: number;
};

type DirectDbQueryInput = {
  teamId: string;
  resource: DirectDbResource;
  credential: ResolvedCredentialRef;
  queryType: string;
  query: string;
  params: Record<string, unknown>;
  contract: QueryContract;
  adapterKey: string;
  authAdapterKey: string;
  runId: string;
};

type DirectDbQueryOutput = {
  status: 'completed' | 'failed' | 'blocked' | 'cancelled';
  result: Prisma.InputJsonValue;
  error?: string;
};

type DirectDbCredentialConfig = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  database?: string;
  sslMode?: string;
};

@Injectable()
export class DirectDbQueryExecutor {
  private readonly encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-32-chars-long!!!!!';

  constructor(private readonly prisma: PrismaService) {}

  async execute(input: DirectDbQueryInput): Promise<DirectDbQueryOutput> {
    if (input.credential.transport !== 'direct_db' || !input.credential.referenceId) {
      return {
        status: 'blocked',
        result: this.toJsonValue(this.blockedResult(input, ['Direct DB query requires a dedicated readonly credential.'])),
        error: '缺少 DB/Redis 只读查询凭据',
      };
    }

    const credential = await this.resolveCredentialConfig(
      input.teamId,
      input.credential.referenceId,
      input.credential.credentialType,
    );

    if (input.queryType === 'sql') {
      return this.executeMysqlQuery(input, credential);
    }

    if (input.queryType === 'redis_scan') {
      return this.executeRedisQuery(input, credential);
    }

    return {
      status: 'blocked',
      result: this.toJsonValue(this.blockedResult(input, [`${input.queryType} does not use direct DB transport.`])),
      error: '当前查询类型不支持 Direct DB adapter',
    };
  }

  private async executeMysqlQuery(
    input: DirectDbQueryInput,
    credential: DirectDbCredentialConfig,
  ): Promise<DirectDbQueryOutput> {
    if (!credential.username) {
      throw new BadRequestException('MySQL 只读凭据缺少 username');
    }

    const limit = this.resolveLimit(input.params, input.contract);
    const sql = this.applyMysqlLimit(input.query, limit);
    const connection = await createConnection({
      host: credential.host,
      port: credential.port,
      user: credential.username,
      password: credential.password,
      database: this.asString(input.params.database) || credential.database,
      connectTimeout: this.resolveTimeout(input.params),
      ssl: this.mysqlSslConfig(credential.sslMode),
    });

    try {
      const [rows, fields] = await connection.query({
        sql,
        timeout: this.resolveTimeout(input.params),
      });
      const normalizedRows = Array.isArray(rows)
        ? rows.map((row) => this.asRecord(row as Prisma.JsonValue))
        : [];
      const columns = this.columnsForMysqlResult(fields, normalizedRows);
      return {
        status: 'completed',
        result: this.toJsonValue(this.liveResult(input, columns, normalizedRows.slice(0, limit), {
          limit,
          returned: Math.min(normalizedRows.length, limit),
          hasMore: normalizedRows.length > limit,
          cursor: null,
          nextCursor: null,
        })),
      };
    } finally {
      await connection.end();
    }
  }

  private async executeRedisQuery(
    input: DirectDbQueryInput,
    credential: DirectDbCredentialConfig,
  ): Promise<DirectDbQueryOutput> {
    const redis = new Redis({
      host: credential.host,
      port: credential.port,
      username: credential.username,
      password: credential.password,
      db: this.asPositiveInt(credential.database, 0, 16),
      connectTimeout: this.resolveTimeout(input.params),
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      lazyConnect: true,
    });

    try {
      await redis.connect();
      const output = await this.runRedisReadonlyCommand(redis, input);
      return {
        status: 'completed',
        result: this.toJsonValue(this.liveResult(
          input,
          output.columns,
          output.rows,
          output.pageInfo,
        )),
      };
    } finally {
      redis.disconnect();
    }
  }

  private async runRedisReadonlyCommand(
    redis: Redis,
    input: DirectDbQueryInput,
  ) {
    const tokens = this.tokenizeRedisCommand(input.query);
    const command = tokens[0]?.toLowerCase();
    const args = tokens.slice(1);
    const limit = this.resolveLimit(input.params, input.contract);

    if (command === 'scan') {
      const cursor = args[0] || this.asString(input.params.cursor) || '0';
      const matchIndex = args.findIndex((arg) => arg.toLowerCase() === 'match');
      const match = matchIndex >= 0 ? args[matchIndex + 1] : this.asString(input.params.match);
      const scanResult = match
        ? await redis.call('SCAN', cursor, 'MATCH', match, 'COUNT', String(limit))
        : await redis.call('SCAN', cursor, 'COUNT', String(limit));
      const [nextCursor, keys] = scanResult as [string, string[]];
      const rows = await Promise.all(keys.slice(0, limit).map(async (key) => ({
        cursor: nextCursor,
        key,
        type: await redis.type(key),
        ttl: await redis.ttl(key),
      })));
      return {
        columns: input.contract.columns,
        rows,
        pageInfo: {
          limit,
          returned: rows.length,
          hasMore: nextCursor !== '0',
          cursor,
          nextCursor,
        },
      };
    }

    if (command === 'info') {
      const section = args[0];
      const raw = section ? await redis.info(section) : await redis.info();
      const rows = raw
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith('#'))
        .slice(0, limit)
        .map((line) => {
          const [field, ...rest] = line.split(':');
          return { field, value: rest.join(':') };
        });
      return {
        columns: [
          { key: 'field', label: 'Field', type: 'string', masked: false },
          { key: 'value', label: 'Value', type: 'string', masked: true },
        ],
        rows,
        pageInfo: { limit, returned: rows.length, hasMore: false, cursor: null, nextCursor: null },
      };
    }

    if (command === 'ping') {
      const value = await redis.ping();
      return {
        columns: [
          { key: 'field', label: 'Field', type: 'string', masked: false },
          { key: 'value', label: 'Value', type: 'string', masked: false },
        ],
        rows: [{ field: 'ping', value }],
        pageInfo: { limit, returned: 1, hasMore: false, cursor: null, nextCursor: null },
      };
    }

    if (['ttl', 'type', 'exists'].includes(command || '')) {
      const key = args[0];
      if (!key) {
        throw new BadRequestException(`Redis ${command?.toUpperCase()} 需要 key 参数`);
      }
      const value = command === 'ttl'
        ? await redis.ttl(key)
        : command === 'type'
          ? await redis.type(key)
          : await redis.exists(key);
      return {
        columns: [
          { key: 'key', label: 'Key', type: 'string', masked: true },
          { key: 'command', label: 'Command', type: 'string', masked: false },
          { key: 'value', label: 'Value', type: 'string', masked: false },
        ],
        rows: [{ key, command: command?.toUpperCase(), value }],
        pageInfo: { limit, returned: 1, hasMore: false, cursor: null, nextCursor: null },
      };
    }

    throw new BadRequestException('Redis 只读 adapter 仅支持 SCAN/INFO/PING/TTL/TYPE/EXISTS');
  }

  private async resolveCredentialConfig(
    teamId: string,
    credentialId: string,
    credentialType: string,
  ): Promise<DirectDbCredentialConfig> {
    const credential = await this.prisma.teamCredential.findFirst({
      where: { id: credentialId, teamId },
      select: { id: true, type: true, config: true },
    });

    if (!credential) {
      throw new NotFoundException('只读查询凭据不存在或不属于当前团队');
    }

    if (!credential.type.startsWith('db_') || credential.type !== credentialType) {
      throw new BadRequestException('只读查询凭据类型与执行 adapter 不匹配');
    }

    const config = this.parseCredentialConfig(credential.config);
    const host = this.asString(config.host);
    const port = this.asPositiveInt(config.port, credential.type === 'db_redis_readonly' ? 6379 : 3306, 65535);
    if (!host) {
      throw new BadRequestException('只读查询凭据缺少 host');
    }

    return {
      host,
      port,
      username: this.asString(config.username),
      password: this.asString(config.password),
      database: this.asString(config.database),
      sslMode: this.asString(config.sslMode),
    };
  }

  private parseCredentialConfig(encryptedConfig: string) {
    try {
      return this.asRecord(JSON.parse(this.decrypt(encryptedConfig)) as Prisma.JsonValue);
    } catch (error) {
      if (encryptedConfig.trim().startsWith('{')) {
        return this.asRecord(JSON.parse(encryptedConfig) as Prisma.JsonValue);
      }
      throw new BadRequestException('只读查询凭据无法解密或格式无效');
    }
  }

  private decrypt(text: string): string {
    const [ivHex, authTagHex, encrypted] = text.split(':');
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('invalid encrypted credential format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private applyMysqlLimit(query: string, limit: number) {
    const trimmed = query.trim().replace(/;\s*$/, '');
    if (!/^\s*select\b/i.test(trimmed)) {
      return trimmed;
    }
    return `SELECT * FROM (${trimmed}) AS devpilot_readonly_query LIMIT ${limit}`;
  }

  private columnsForMysqlResult(
    fields: FieldPacket[],
    rows: Array<Record<string, unknown>>,
  ) {
    const sourceColumns = fields.length
      ? fields.map((field) => field.name)
      : Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    return sourceColumns.map((key) => ({
      key,
      label: key,
      type: this.inferColumnType(rows.find((row) => row[key] !== null && row[key] !== undefined)?.[key]),
      masked: this.isSecretLikeKey(key),
    }));
  }

  private liveResult(
    input: DirectDbQueryInput,
    columns: Array<{ key: string; label: string; type: string; masked: boolean }>,
    rows: Array<Record<string, unknown>>,
    pageInfo: Record<string, unknown>,
  ) {
    const secretPatterns = this.secretKeyPatterns();
    const maskedRows = rows.map((row) => this.maskRow(row, secretPatterns));
    return {
      mode: 'live_direct_db_query',
      executed: true,
      executorKey: 'direct-db-adapter',
      adapterKey: input.adapterKey,
      authAdapterKey: input.authAdapterKey,
      adapterState: {
        current: 'live_readonly_driver_executed',
        executable: true,
        nextExecutorBoundary: 'direct_db_driver_adapter',
      },
      preview: {
        source: 'live_adapter',
        sample: false,
        shape: 'table',
        columns,
        rows: maskedRows,
        pageInfo,
        redaction: {
          enabled: true,
          policy: 'mask_secret_like_columns_before_persisting',
          maskedColumnKeys: columns.filter((column) => column.masked).map((column) => column.key),
          secretKeyPatterns: secretPatterns,
        },
        notes: [
          '真实只读 adapter 已执行；结果在写入 ResourceQueryRun 前完成脱敏。',
          'Credential secret material 只在 direct_db driver 边界内使用，不写入 run/result/audit。',
        ],
      },
      livePrerequisites: [
        { key: 'read_only_validation', status: 'ready', detail: 'read-only query validated before execution' },
        { key: 'credential_binding', status: 'ready', detail: 'Direct DB read-only credential resolved' },
        { key: 'read_only_driver_credential', status: 'ready', detail: 'Dedicated readonly account material loaded inside driver boundary' },
        { key: 'executor_adapter', status: 'ready', detail: `${input.adapterKey} live transport executed` },
      ],
      warnings: [],
      metadata: {
        resourceQueryRunId: input.runId,
        credentialRef: input.credential.referenceId,
      },
    };
  }

  private blockedResult(input: DirectDbQueryInput, warnings: string[]) {
    return {
      mode: 'blocked_live_transport',
      executed: false,
      executorKey: 'direct-db-adapter',
      adapterKey: input.adapterKey,
      authAdapterKey: input.authAdapterKey,
      adapterState: {
        current: 'blocked_live_transport',
        executable: false,
        nextExecutorBoundary: 'direct_db_driver_adapter',
      },
      warnings,
    };
  }

  private mysqlSslConfig(sslMode?: string) {
    const normalized = sslMode?.trim().toLowerCase();
    if (!normalized || normalized === 'disabled' || normalized === 'false') {
      return undefined;
    }
    return { rejectUnauthorized: normalized === 'verify_identity' || normalized === 'verify_ca' };
  }

  private tokenizeRedisCommand(query: string) {
    return query.match(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|\S+/g)?.map((token) => (
      token.replace(/^['"]|['"]$/g, '')
    )) || [];
  }

  private resolveLimit(params: Record<string, unknown>, contract: QueryContract) {
    return this.asPositiveInt(params.limit, contract.rowLimitDefault, contract.rowLimitMax);
  }

  private resolveTimeout(params: Record<string, unknown>) {
    return this.asPositiveInt(params.timeoutMs, 5000, 30000);
  }

  private inferColumnType(value: unknown) {
    if (value instanceof Date) return 'datetime';
    if (typeof value === 'number' || typeof value === 'bigint') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'string';
  }

  private isSecretLikeKey(key: string) {
    return this.secretKeyPatterns().some((pattern) => key.toLowerCase().includes(pattern.toLowerCase()));
  }

  private secretKeyPatterns() {
    return ['password', 'secret', 'token', 'credential', 'authorization', 'accessKey', 'secretKey'];
  }

  private maskRow(row: Record<string, unknown>, secretPatterns: string[]) {
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        secretPatterns.some((pattern) => key.toLowerCase().includes(pattern.toLowerCase()))
          ? '******'
          : this.jsonSafeValue(value),
      ]),
    );
  }

  private jsonSafeValue(value: unknown): Prisma.JsonValue {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Buffer.isBuffer(value)) {
      return value.toString('base64');
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.jsonSafeValue(item)) as Prisma.JsonArray;
    }
    if (typeof value === 'object') {
      const result: Record<string, Prisma.JsonValue> = {};
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        result[key] = this.jsonSafeValue(item);
      }
      return result as Prisma.JsonObject;
    }
    return String(value);
  }

  private asRecord(value: Prisma.JsonValue | null | undefined) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private asString(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private asPositiveInt(value: unknown, fallback: number, max: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.min(Math.floor(parsed), max);
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
