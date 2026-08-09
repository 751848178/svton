/**
 * GlobalExceptionFilter 回归测试（CR-3-F3）：
 * 验证 HttpException 携带的业务字符串 code（如 RELEASE_PLAN_STALE）被原样透传到响应体，
 * 而不是被丢弃替换为 HTTP status 数字。前端 classifyReleaseError 据此触发 autoRepreview。
 */
import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { GlobalExceptionFilter } from "./http-exception.filter";

interface MockResponse {
  statusCode: number;
  body: unknown;
  status(code: number): MockResponse;
  json(b: unknown): void;
}

function mockHost(): {
  host: ArgumentsHost;
  response: MockResponse;
  request: { method: string; url: string; id?: string };
} {
  const response: MockResponse = {
    statusCode: 0,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(b: unknown) {
      this.body = b;
    },
  };
  const request = { method: "POST", url: "/release/plans", id: "trace-1" };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, response, request };
}

describe("GlobalExceptionFilter (CR-3-F3 business string code preservation)", () => {
  it("HttpException with string code → body.code is the string (not HTTP status)", () => {
    const filter = new GlobalExceptionFilter(undefined);
    const { host, response } = mockHost();
    const exc = new ConflictException({
      code: "RELEASE_PLAN_STALE",
      message: "预览已过期，请重新生成",
      expected: "h-new",
      received: "h-old",
    });
    filter.catch(exc, host);
    expect(response.statusCode).toBe(HttpStatus.CONFLICT);
    const body = response.body as {
      code: unknown;
      message: string;
      data: unknown;
    };
    expect(body.code).toBe("RELEASE_PLAN_STALE");
    expect(body.message).toBe("预览已过期，请重新生成");
    expect(body.data).toBeNull();
  });

  it("HttpException without string code → body.code falls back to HTTP status number", () => {
    const filter = new GlobalExceptionFilter(undefined);
    const { host, response } = mockHost();
    filter.catch(new BadRequestException("bad input"), host);
    expect(response.statusCode).toBe(HttpStatus.BAD_REQUEST);
    const body = response.body as { code: unknown; message: string };
    expect(body.code).toBe(HttpStatus.BAD_REQUEST);
    expect(typeof body.code).toBe("number");
  });

  it("HttpException with non-string code (number) → falls back to HTTP status", () => {
    const filter = new GlobalExceptionFilter(undefined);
    const { host, response } = mockHost();
    const exc = new HttpException(
      { code: 42, message: "weird" },
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(exc, host);
    const body = response.body as { code: unknown };
    expect(body.code).toBe(HttpStatus.BAD_REQUEST);
  });

  it("exposes only explicitly opted-in public error data", () => {
    const filter = new GlobalExceptionFilter(undefined);
    const { host, response } = mockHost();
    filter.catch(
      new HttpException(
        {
          code: "RELEASE_GATE_BLOCKED",
          message: "blocked",
          publicData: {
            decision: { id: "decision-1", blockerGateIds: ["D10"] },
          },
          internalSecret: "must-not-pass",
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      ),
      host,
    );
    expect(response.body).toMatchObject({
      code: "RELEASE_GATE_BLOCKED",
      data: { decision: { id: "decision-1", blockerGateIds: ["D10"] } },
    });
    expect(JSON.stringify(response.body)).not.toContain("must-not-pass");
  });
});
