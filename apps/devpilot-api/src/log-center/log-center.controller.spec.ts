import { AuditEventService } from "../audit-event";
import { ControlAccessPolicyService } from "../control-access-policy";
import { LogCenterService } from "./log-center.service";
import { LogStreamSessionRegistry } from "./log-stream-session.registry";
import { LogStreamTailController } from "./log-stream-tail.controller";

describe("LogStreamTailController tail", () => {
  it("checks log read policy before returning stream tail entries", async () => {
    const logCenterService = {
      getStreamAccessScope: jest.fn().mockResolvedValue({
        projectId: "project-1",
        environmentId: "env-1",
      }),
      tailStreamEntries: jest.fn().mockResolvedValue({
        streamId: "stream-1",
        entries: [],
        cursor: null,
      }),
    };
    const accessPolicyService = {
      assertCanRead: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new LogStreamTailController(
      logCenterService as unknown as LogCenterService,
      accessPolicyService as unknown as ControlAccessPolicyService,
    );

    const result = await controller.tailStreamEntries(
      { teamId: "team-1", user: { id: "user-1" } },
      "stream-1",
      { limit: 25 },
    );

    expect(logCenterService.getStreamAccessScope).toHaveBeenCalledWith(
      "team-1",
      "stream-1",
    );
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith({
      teamId: "team-1",
      actorId: "user-1",
      projectId: "project-1",
      environmentId: "env-1",
      category: "log",
      action: "log.stream.tail",
      targetType: "log_stream",
      targetId: "stream-1",
      risk: "low",
    });
    expect(logCenterService.tailStreamEntries).toHaveBeenCalledWith(
      "team-1",
      "stream-1",
      { limit: 25 },
    );
    expect(result).toEqual({
      streamId: "stream-1",
      entries: [],
      cursor: null,
    });
  });

  it("checks log read policy before opening stream tail events", async () => {
    let closeHandler: (() => void) | undefined;
    const logCenterService = {
      getStreamAccessScope: jest.fn().mockResolvedValue({
        projectId: "project-1",
        environmentId: "env-1",
      }),
      tailStreamEntries: jest.fn().mockResolvedValue({
        streamId: "stream-1",
        entries: [],
        cursor: "cursor-1",
      }),
    };
    const accessPolicyService = {
      assertCanRead: jest.fn().mockResolvedValue(undefined),
    };
    const response = {
      status: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      writableEnded: false,
    };
    const controller = new LogStreamTailController(
      logCenterService as unknown as LogCenterService,
      accessPolicyService as unknown as ControlAccessPolicyService,
    );

    await controller.streamTailEvents(
      {
        teamId: "team-1",
        user: { id: "user-1" },
        on: jest.fn((event: string, handler: () => void) => {
          if (event === "close") closeHandler = handler;
        }),
      },
      "stream-1",
      { limit: 25, pollIntervalMs: 1000 },
      undefined,
      response as never,
    );
    closeHandler?.();

    expect(logCenterService.getStreamAccessScope).toHaveBeenCalledWith(
      "team-1",
      "stream-1",
    );
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith({
      teamId: "team-1",
      actorId: "user-1",
      projectId: "project-1",
      environmentId: "env-1",
      category: "log",
      action: "log.stream.tail",
      targetType: "log_stream",
      targetId: "stream-1",
      risk: "low",
    });
    expect(response.set).toHaveBeenCalledWith(
      expect.objectContaining({
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      }),
    );
    expect(logCenterService.tailStreamEntries).toHaveBeenCalledWith(
      "team-1",
      "stream-1",
      {
        cursor: undefined,
        limit: 25,
      },
    );
    expect(response.write).toHaveBeenCalledWith("event: ready\n");
    expect(response.write).toHaveBeenCalledWith("event: heartbeat\n");
  });

  it("resumes stream tail events from the Last-Event-ID cursor", async () => {
    let closeHandler: (() => void) | undefined;
    const logCenterService = {
      getStreamAccessScope: jest.fn().mockResolvedValue({
        projectId: "project-1",
        environmentId: "env-1",
      }),
      tailStreamEntries: jest.fn().mockResolvedValue({
        streamId: "stream-1",
        entries: [{ id: "entry-2", message: "next line", level: "info" }],
        cursor: "cursor-2",
      }),
    };
    const accessPolicyService = {
      assertCanRead: jest.fn().mockResolvedValue(undefined),
    };
    const response = {
      status: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      writableEnded: false,
    };
    const controller = new LogStreamTailController(
      logCenterService as unknown as LogCenterService,
      accessPolicyService as unknown as ControlAccessPolicyService,
    );

    await controller.streamTailEvents(
      {
        teamId: "team-1",
        user: { id: "user-1" },
        on: jest.fn((event: string, handler: () => void) => {
          if (event === "close") closeHandler = handler;
        }),
      },
      "stream-1",
      { limit: 50, pollIntervalMs: 1000 },
      "cursor-1",
      response as never,
    );
    closeHandler?.();

    expect(logCenterService.tailStreamEntries).toHaveBeenCalledWith(
      "team-1",
      "stream-1",
      {
        cursor: "cursor-1",
        limit: 50,
      },
    );
    expect(response.write).toHaveBeenCalledWith("id: cursor-1\n");
    expect(response.write).toHaveBeenCalledWith("id: cursor-2\n");
    expect(response.write).toHaveBeenCalledWith("retry: 1000\n");
    expect(response.write).toHaveBeenCalledWith("event: entries\n");
  });

  it("emits session metadata and closes stream sessions at max duration", async () => {
    jest.useFakeTimers();
    try {
      const logCenterService = {
        getStreamAccessScope: jest.fn().mockResolvedValue({
          projectId: "project-1",
          environmentId: "env-1",
        }),
        tailStreamEntries: jest.fn().mockResolvedValue({
          streamId: "stream-1",
          entries: [],
          cursor: "cursor-1",
        }),
      };
      const accessPolicyService = {
        assertCanRead: jest.fn().mockResolvedValue(undefined),
      };
      const response = {
        status: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        writableEnded: false,
      };
      const controller = new LogStreamTailController(
        logCenterService as unknown as LogCenterService,
        accessPolicyService as unknown as ControlAccessPolicyService,
      );

      await controller.streamTailEvents(
        {
          teamId: "team-1",
          user: { id: "user-1" },
          on: jest.fn(),
        },
        "stream-1",
        { limit: 25, pollIntervalMs: 1000, maxSessionMs: 30000 },
        undefined,
        response as never,
      );

      expect(response.set).toHaveBeenCalledWith(
        expect.objectContaining({
          "X-Log-Stream-Session-Id": expect.any(String),
          "X-Log-Stream-Session-Expires-At": expect.any(String),
          "X-Log-Stream-Max-Actor-Active-Sessions": expect.any(String),
          "X-Log-Stream-Max-Team-Active-Sessions": expect.any(String),
        }),
      );
      expect(response.write).toHaveBeenCalledWith(
        expect.stringContaining('"maxSessionMs":30000'),
      );
      expect(response.write).toHaveBeenCalledWith(
        expect.stringContaining('"sessionId":'),
      );
      expect(response.write).toHaveBeenCalledWith(
        expect.stringContaining('"maxActorActiveSessions"'),
      );
      expect(response.write).toHaveBeenCalledWith(
        expect.stringContaining('"maxTeamActiveSessions"'),
      );
      jest.advanceTimersByTime(30000);
      expect(response.write).toHaveBeenCalledWith("event: closing\n");
      expect(response.write).toHaveBeenCalledWith(
        expect.stringContaining('"reason":"max_session_duration"'),
      );
      expect(response.end).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("lists and closes active stream sessions through policy checks", async () => {
    const registry = new LogStreamSessionRegistry();
    const logCenterService = {
      getStreamAccessScope: jest.fn().mockResolvedValue({
        projectId: "project-1",
        environmentId: "env-1",
      }),
      tailStreamEntries: jest.fn().mockResolvedValue({
        streamId: "stream-1",
        entries: [],
        cursor: "cursor-1",
      }),
    };
    const accessPolicyService = {
      assertCanRead: jest.fn().mockResolvedValue(undefined),
      canRead: jest.fn().mockResolvedValue(true),
      assertCanWrite: jest.fn().mockResolvedValue(undefined),
    };
    const auditEventService = {
      create: jest.fn().mockResolvedValue({}),
    };
    const response = {
      status: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      writableEnded: false,
    };
    const controller = new LogStreamTailController(
      logCenterService as unknown as LogCenterService,
      accessPolicyService as unknown as ControlAccessPolicyService,
      registry,
      auditEventService as unknown as AuditEventService,
    );

    await controller.streamTailEvents(
      {
        teamId: "team-1",
        user: { id: "user-1" },
        on: jest.fn(),
      },
      "stream-1",
      { limit: 25, pollIntervalMs: 1000, maxSessionMs: 30000 },
      undefined,
      response as never,
    );

    const sessions = await controller.listStreamSessions(
      { teamId: "team-1", user: { id: "user-1" } },
      "stream-1",
    );
    expect(sessions).toHaveLength(1);
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "log.stream.tail",
        targetType: "log_stream",
        targetId: "stream-1",
      }),
    );

    const result = await controller.closeStreamSession(
      { teamId: "team-1", user: { id: "user-1" } },
      sessions[0].id,
    );
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "log.stream_session.close",
        targetType: "log_stream",
        targetId: "stream-1",
        risk: "low",
      }),
    );
    expect(result).toEqual({
      sessionId: sessions[0].id,
      streamId: "stream-1",
      status: "closing",
    });
    expect(auditEventService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team-1",
        actorId: "user-1",
        projectId: "project-1",
        environmentId: "env-1",
        logStreamId: "stream-1",
        category: "log",
        action: "log.stream_session.close",
        targetType: "log_stream_session",
        targetId: sessions[0].id,
        risk: "low",
        status: "completed",
        metadata: expect.objectContaining({
          streamId: "stream-1",
          sessionId: sessions[0].id,
          sessionActorId: "user-1",
          closeReason: "manual_close",
        }),
      }),
    );
    expect(response.write).toHaveBeenCalledWith("event: closing\n");
    expect(response.write).toHaveBeenCalledWith(
      expect.stringContaining('"reason":"manual_close"'),
    );
    expect(response.end).toHaveBeenCalled();
    await expect(
      controller.listStreamSessions(
        { teamId: "team-1", user: { id: "user-1" } },
        "stream-1",
      ),
    ).resolves.toEqual([]);
  });

  it("limits active stream sessions per log stream", async () => {
    const originalLimit = process.env.LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_STREAM;
    process.env.LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_STREAM = "1";
    let closeHandler: (() => void) | undefined;
    try {
      const registry = new LogStreamSessionRegistry();
      const logCenterService = {
        getStreamAccessScope: jest.fn().mockResolvedValue({
          projectId: "project-1",
          environmentId: "env-1",
        }),
        tailStreamEntries: jest.fn().mockResolvedValue({
          streamId: "stream-1",
          entries: [],
          cursor: "cursor-1",
        }),
      };
      const accessPolicyService = {
        assertCanRead: jest.fn().mockResolvedValue(undefined),
      };
      const controller = new LogStreamTailController(
        logCenterService as unknown as LogCenterService,
        accessPolicyService as unknown as ControlAccessPolicyService,
        registry,
      );

      await controller.streamTailEvents(
        {
          teamId: "team-1",
          user: { id: "user-1" },
          on: jest.fn((event: string, handler: () => void) => {
            if (event === "close") closeHandler = handler;
          }),
        },
        "stream-1",
        { limit: 25, pollIntervalMs: 1000 },
        undefined,
        {
          status: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          flushHeaders: jest.fn(),
          write: jest.fn(),
          writableEnded: false,
        } as never,
      );

      await expect(
        controller.streamTailEvents(
          {
            teamId: "team-1",
            user: { id: "user-1" },
            on: jest.fn(),
          },
          "stream-1",
          { limit: 25, pollIntervalMs: 1000 },
          undefined,
          {
            status: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            flushHeaders: jest.fn(),
            write: jest.fn(),
            writableEnded: false,
          } as never,
        ),
      ).rejects.toThrow("日志流活跃会话已达上限");
    } finally {
      closeHandler?.();
      if (originalLimit === undefined) {
        delete process.env.LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_STREAM;
      } else {
        process.env.LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_STREAM = originalLimit;
      }
    }
  });

  it("limits active stream sessions per team", async () => {
    const originalLimit = process.env.LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_TEAM;
    process.env.LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_TEAM = "1";
    let closeHandler: (() => void) | undefined;
    try {
      const registry = new LogStreamSessionRegistry();
      const logCenterService = {
        getStreamAccessScope: jest.fn().mockResolvedValue({
          projectId: "project-1",
          environmentId: "env-1",
        }),
        tailStreamEntries: jest.fn().mockResolvedValue({
          streamId: "stream-1",
          entries: [],
          cursor: "cursor-1",
        }),
      };
      const accessPolicyService = {
        assertCanRead: jest.fn().mockResolvedValue(undefined),
      };
      const controller = new LogStreamTailController(
        logCenterService as unknown as LogCenterService,
        accessPolicyService as unknown as ControlAccessPolicyService,
        registry,
      );

      await controller.streamTailEvents(
        {
          teamId: "team-1",
          user: { id: "user-1" },
          on: jest.fn((event: string, handler: () => void) => {
            if (event === "close") closeHandler = handler;
          }),
        },
        "stream-1",
        { limit: 25, pollIntervalMs: 1000 },
        undefined,
        {
          status: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          flushHeaders: jest.fn(),
          write: jest.fn(),
          writableEnded: false,
        } as never,
      );

      await expect(
        controller.streamTailEvents(
          {
            teamId: "team-1",
            user: { id: "user-2" },
            on: jest.fn(),
          },
          "stream-2",
          { limit: 25, pollIntervalMs: 1000 },
          undefined,
          {
            status: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            flushHeaders: jest.fn(),
            write: jest.fn(),
            writableEnded: false,
          } as never,
        ),
      ).rejects.toThrow("团队日志流活跃会话已达上限");
    } finally {
      closeHandler?.();
      if (originalLimit === undefined) {
        delete process.env.LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_TEAM;
      } else {
        process.env.LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_TEAM = originalLimit;
      }
    }
  });

  it("limits active stream sessions per user", async () => {
    const originalLimit = process.env.LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_ACTOR;
    process.env.LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_ACTOR = "1";
    let closeHandler: (() => void) | undefined;
    try {
      const registry = new LogStreamSessionRegistry();
      const logCenterService = {
        getStreamAccessScope: jest.fn().mockResolvedValue({
          projectId: "project-1",
          environmentId: "env-1",
        }),
        tailStreamEntries: jest.fn().mockResolvedValue({
          streamId: "stream-1",
          entries: [],
          cursor: "cursor-1",
        }),
      };
      const accessPolicyService = {
        assertCanRead: jest.fn().mockResolvedValue(undefined),
      };
      const controller = new LogStreamTailController(
        logCenterService as unknown as LogCenterService,
        accessPolicyService as unknown as ControlAccessPolicyService,
        registry,
      );

      await controller.streamTailEvents(
        {
          teamId: "team-1",
          user: { id: "user-1" },
          on: jest.fn((event: string, handler: () => void) => {
            if (event === "close") closeHandler = handler;
          }),
        },
        "stream-1",
        { limit: 25, pollIntervalMs: 1000 },
        undefined,
        {
          status: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          flushHeaders: jest.fn(),
          write: jest.fn(),
          writableEnded: false,
        } as never,
      );

      await expect(
        controller.streamTailEvents(
          {
            teamId: "team-1",
            user: { id: "user-1" },
            on: jest.fn(),
          },
          "stream-2",
          { limit: 25, pollIntervalMs: 1000 },
          undefined,
          {
            status: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            flushHeaders: jest.fn(),
            write: jest.fn(),
            writableEnded: false,
          } as never,
        ),
      ).rejects.toThrow("当前用户日志流活跃会话已达上限");
    } finally {
      closeHandler?.();
      if (originalLimit === undefined) {
        delete process.env.LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_ACTOR;
      } else {
        process.env.LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_ACTOR = originalLimit;
      }
    }
  });
});
