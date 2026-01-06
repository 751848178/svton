import { HttpStatus } from '@nestjs/common';

interface PrismaClientKnownRequestError {
  code: string;
  meta?: Record<string, unknown>;
  message: string;
  clientVersion: string;
}

interface MappedError {
  status: number;
  code: number;
  message: string;
}

/**
 * 检查是否为 Prisma 错误
 */
export function isPrismaError(error: unknown): error is PrismaClientKnownRequestError {
  if (typeof error !== 'object' || error === null) return false;
  const err = error as Record<string, unknown>;
  return (
    typeof err.code === 'string' &&
    err.code.startsWith('P') &&
    typeof err.clientVersion === 'string'
  );
}

/**
 * 映射 Prisma 错误到 HTTP 错误
 */
export function mapPrismaError(error: PrismaClientKnownRequestError): MappedError {
  const { code, meta } = error;

  switch (code) {
    // 唯一约束冲突
    case 'P2002': {
      const target = meta?.target as string[] | undefined;
      const fields = target?.join(', ') || 'field';
      return {
        status: HttpStatus.CONFLICT,
        code: 40901,
        message: `Unique constraint violation on ${fields}`,
      };
    }

    // 记录不存在
    case 'P2001':
    case 'P2025': {
      return {
        status: HttpStatus.NOT_FOUND,
        code: 40401,
        message: 'Record not found',
      };
    }

    // 外键约束失败
    case 'P2003': {
      const field = meta?.field_name as string | undefined;
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 40001,
        message: `Foreign key constraint failed on ${field || 'field'}`,
      };
    }

    // 必填字段缺失
    case 'P2011': {
      const constraint = meta?.constraint as string | undefined;
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 40002,
        message: `Required field missing: ${constraint || 'unknown'}`,
      };
    }

    // 无效数据
    case 'P2006':
    case 'P2007': {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 40003,
        message: 'Invalid data provided',
      };
    }

    // 连接错误
    case 'P1001':
    case 'P1002':
    case 'P1003': {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        code: 50301,
        message: 'Database connection error',
      };
    }

    // 默认处理
    default: {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 50001,
        message: 'Database operation failed',
      };
    }
  }
}
