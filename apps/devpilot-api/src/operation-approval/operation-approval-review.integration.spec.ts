/**
 * F470 — 强制性真实 MySQL 并发审批集成测试。
 *
 * 验证 pending→终态只能成功一次，唯一并发决策点是 Prisma updateMany CAS
 * (where: id+teamId+status:pending)，胜者 count===1，输家 count===0 → 结构化 409。
 *
 * 必须用一次性 disposable MySQL（不使用共享 parity 库），由 RUN_OPERATION_APPROVAL_INTEGRATION=1
 * 与显式 DATABASE_URL 双重门控。未设置时整体跳过（CI 默认行为）。
 *
 * 并发模型（按规范）：两方 barrier 放在 access-policy fake 内 —— approve/reject 两个 reviewer
 * 都先完成团队作用域 pending read、都到达授权检查（assertCanReviewApproval），barrier 放行后
 * 才同时进入真实 Prisma CAS。$transaction 把 CAS 写与唯一 decision audit 绑在同一事务。
 *
 * 运行：
 *   docker run -d --rm --name svton-mysql-f470 -e MYSQL_ROOT_PASSWORD=x \
 *     -e MYSQL_DATABASE=f470 -p 3470:3306 mysql:8
 *   DATABASE_URL="mysql://root:x@localhost:3470/f470" npx prisma migrate deploy
 *   DATABASE_URL="mysql://root:x@localhost:3470/f470" RUN_OPERATION_APPROVAL_INTEGRATION=1 \
 *     npx jest --runInBand src/operation-approval/operation-approval-review.integration.spec.ts
 */
import { ConflictException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { AuditEventService } from "../audit-event/audit-event.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  OPERATION_APPROVAL_REVIEW_CONFLICT,
  OperationApprovalReviewService,
} from "./operation-approval-review.service";
import { OperationApprovalAuditService } from "./operation-approval-audit.service";
import { OperationApprovalRepository } from "./operation-approval.repository";

const isIntegration = process.env.RUN_OPERATION_APPROVAL_INTEGRATION === "1";
const describeIntegration = isIntegration
  ? describe
  : (describe.skip as jest.Describe);

// Deferred：无 timer 的确定性 gate 原语。
function deferred<T = void>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

// 两方 barrier：两个 reviewer 都到达授权（enter）后，测试 letGo() 同时放行进入真实 CAS。
function twoPartyBarrier() {
  const a = { entered: deferred<void>(), gate: deferred<void>() };
  const b = { entered: deferred<void>(), gate: deferred<void>() };
  let count = 0;
  return {
    // reviewer 到达授权时调用：记录已到达，等个人放行门。
    async arrive() {
      count += 1;
      if (count === 1) a.entered.resolve();
      else b.entered.resolve();
      const self = count === 1 ? a : b;
      await self.gate.promise;
    },
    // 测试等待两个 reviewer 都到达授权（确定性，非 timer）。
    bothEntered() {
      return Promise.all([a.entered.promise, b.entered.promise]);
    },
    // 同时放行两个 reviewer 进入真实 Prisma CAS。
    letGo() {
      a.gate.resolve();
      b.gate.resolve();
    },
  };
}

describeIntegration(
  "F470 OperationApproval concurrent review (real MySQL CAS)",
  () => {
    let prisma: PrismaClient;
    let repo: OperationApprovalRepository;
    let prismaService: PrismaService;

    beforeAll(async () => {
      prisma = new PrismaClient({
        datasources: { db: { url: process.env.DATABASE_URL } },
      });
      await prisma.$connect();
      // PrismaService 是 PrismaClient 子类；用 Object.assign 注入已连接的底层 client。
      prismaService = new PrismaService();
      Object.assign(prismaService, prisma);
      repo = new OperationApprovalRepository(prismaService);
    });
    afterAll(async () => {
      await prisma?.$disconnect();
    });
    jest.setTimeout(30000);

    const rnd = () => Math.random().toString(36).slice(2, 10);

    // 建造一个 OperationApprovalReviewService：accessPolicy 放行门可控；audit 可注入抛错。
    function buildReviewService(opts: {
      accessPolicy: { assertCanReviewApproval: (ctx: any) => Promise<void> };
      auditOverride?: { writeApprovalAudit: (...a: any[]) => Promise<void> };
    }) {
      const auditEventService = new AuditEventService(prismaService);
      const auditService = new OperationApprovalAuditService(auditEventService);
      if (opts.auditOverride) {
        (auditService as any).writeApprovalAudit =
          opts.auditOverride.writeApprovalAudit;
      }
      return new OperationApprovalReviewService(
        prismaService,
        repo,
        auditService,
        opts.accessPolicy as any,
      );
    }

    const allowAll = { assertCanReviewApproval: async () => undefined };

    // 种子：随机 team + requester + 两个 reviewer + 一个直接 pending 的 approval。
    async function seed() {
      const suffix = rnd();
      const team = await prisma.team.create({
        data: { name: `team-${suffix}` },
      });
      const requester = await prisma.user.create({
        data: { email: `req-${suffix}@x.test` },
      });
      const reviewerA = await prisma.user.create({
        data: { email: `rva-${suffix}@x.test` },
      });
      const reviewerB = await prisma.user.create({
        data: { email: `rvb-${suffix}@x.test` },
      });
      const approval = await prisma.operationApproval.create({
        data: {
          teamId: team.id,
          requesterId: requester.id,
          category: "resource_action",
          action: "resource.action.restart",
          targetType: "managed_resource",
          risk: "high",
          status: "pending",
          summary: `seed-${suffix}`,
        },
      });
      return { team, requester, reviewerA, reviewerB, approval, suffix };
    }

    // 仅清理本测试种子产生的随机行（外键顺序：audit → approval → users → team）。
    async function cleanup(suffix: string) {
      await prisma.auditEvent
        .deleteMany({ where: { summary: { contains: suffix } } })
        .catch(() => {});
      await prisma.operationApproval
        .deleteMany({ where: { summary: { contains: suffix } } })
        .catch(() => {});
      // 种子 emails 形如 `req-${suffix}@x.test`，按后缀串精确匹配本批随机用户。
      await prisma.user
        .deleteMany({ where: { email: { contains: `-${suffix}@` } } })
        .catch(() => {});
      await prisma.team
        .deleteMany({ where: { name: { contains: suffix } } })
        .catch(() => {});
    }

    // 1. 核心：两 reviewer 经 barrier 同时越过 pending read + 授权，进入真实 CAS → 恰一胜一 409。
    it("two reviewers pass barrier into real CAS → exactly one wins, one 409; DB row + sole audit belong to winner", async () => {
      const { team, reviewerA, reviewerB, approval, suffix } = await seed();
      try {
        const barrier = twoPartyBarrier();
        const accessPolicy = {
          assertCanReviewApproval: async () => {
            await barrier.arrive();
          },
        };
        const service = buildReviewService({ accessPolicy });

        const approveP = service.review(team.id, reviewerA.id, approval.id, {
          decision: "approved",
          reviewComment: "ok-by-a",
        });
        const rejectP = service.review(team.id, reviewerB.id, approval.id, {
          decision: "rejected",
          reviewComment: "no-by-b",
        });

        // 确定性：等两个 reviewer 都完成 pending read 并到达授权（卡在 barrier）。
        await barrier.bothEntered();
        // 放行：两者同时进入真实 Prisma CAS，行锁序列化 → 恰一胜一负。
        barrier.letGo();

        const results = await Promise.allSettled([approveP, rejectP]);
        const winner = results.find((r) => r.status === "fulfilled");
        const loser = results.find((r) => r.status === "rejected");
        // 恰好一胜一负。
        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
        expect(winner!.status).toBe("fulfilled");
        expect(loser!.status).toBe("rejected");

        // 输家必须是结构化 409 OPERATION_APPROVAL_REVIEW_CONFLICT。
        const loserErr = (loser as PromiseRejectedResult).reason;
        expect(loserErr).toBeInstanceOf(ConflictException);
        expect(loserErr.getResponse()).toMatchObject({
          code: OPERATION_APPROVAL_REVIEW_CONFLICT,
        });

        // DB 终态行属于胜者：status/reviewer/comment 与 fulfilled 结果一致，绝非输家。
        const winnerValue = (winner as PromiseFulfilledResult<any>).value;
        const dbRow = await prisma.operationApproval.findUniqueOrThrow({
          where: { id: approval.id },
        });
        expect(dbRow.status).toBe(winnerValue.status);
        expect(["approved", "rejected"]).toContain(dbRow.status);
        expect(dbRow.reviewerId).toBe(winnerValue.reviewerId);
        expect(dbRow.reviewComment).toBe(winnerValue.reviewComment);
        expect(dbRow.reviewedAt).toBeTruthy();
        // 胜者的 reviewedAt 与 fulfilled 返回值同源（同一捕获值写入）。
        expect(dbRow.reviewedAt).toEqual(winnerValue.reviewedAt);

        // 唯一 decision audit 属于胜者（actor/action 与胜者匹配）。
        const audits = await prisma.auditEvent.findMany({
          where: {
            operationApprovalId: approval.id,
            action: { in: ["approval.approved", "approval.rejected"] },
          },
        });
        expect(audits).toHaveLength(1);
        expect(audits[0].actorId).toBe(winnerValue.reviewerId);
        expect(audits[0].action).toBe(
          winnerValue.status === "approved"
            ? "approval.approved"
            : "approval.rejected",
        );
        expect(audits[0].status).toBe(winnerValue.status);
      } finally {
        await cleanup(suffix);
      }
    });

    // 6. 幂等/重放：胜者后再审（相反决策）→ 409，行不变，仍只一条 decision audit。
    it("replaying the opposite terminal review returns 409, leaves row unchanged, still one decision audit", async () => {
      const { team, reviewerA, reviewerB, approval, suffix } = await seed();
      try {
        const service = buildReviewService({ accessPolicy: allowAll });
        const first = await service.review(team.id, reviewerA.id, approval.id, {
          decision: "approved",
          reviewComment: "approved after review",
        });
        expect(first?.status).toBe("approved");

        // 相反决策重放：CAS 谓词 status:pending 命中 0 行 → 409。
        await expect(
          service.review(team.id, reviewerB.id, approval.id, {
            decision: "rejected",
            reviewComment: "late",
          }),
        ).rejects.toThrow(ConflictException);

        // 行不变（仍是胜者 a 的 approved）。
        const dbRow = await prisma.operationApproval.findUniqueOrThrow({
          where: { id: approval.id },
        });
        expect(dbRow.status).toBe("approved");
        expect(dbRow.reviewerId).toBe(reviewerA.id);
        // 仍只一条 decision audit。
        const audits = await prisma.auditEvent.findMany({
          where: {
            operationApprovalId: approval.id,
            action: { in: ["approval.approved", "approval.rejected"] },
          },
        });
        expect(audits).toHaveLength(1);
      } finally {
        await cleanup(suffix);
      }
    });

    // 8. 审计抛错 → 事务回滚 → 状态回 pending，无 decision audit。
    it("audit throwing inside the transaction rolls back the decision to pending with no audit", async () => {
      const { team, reviewerA, approval, suffix } = await seed();
      try {
        const service = buildReviewService({
          accessPolicy: allowAll,
          auditOverride: {
            writeApprovalAudit: async () => {
              throw new Error("audit-down");
            },
          },
        });

        await expect(
          service.review(team.id, reviewerA.id, approval.id, {
            decision: "approved",
            reviewComment: "approved after review",
          }),
        ).rejects.toThrow("audit-down");

        // 事务回滚：行仍是 pending，无 reviewer/comment。
        const dbRow = await prisma.operationApproval.findUniqueOrThrow({
          where: { id: approval.id },
        });
        expect(dbRow.status).toBe("pending");
        expect(dbRow.reviewerId).toBeNull();
        expect(dbRow.reviewedAt).toBeNull();
        // 无 decision audit。
        const audits = await prisma.auditEvent.findMany({
          where: {
            operationApprovalId: approval.id,
            action: { in: ["approval.approved", "approval.rejected"] },
          },
        });
        expect(audits).toHaveLength(0);
      } finally {
        await cleanup(suffix);
      }
    });

    // 9. 消费语义：approve → consume 一次成功 → 第二次 consume 影响 0 行 → 再 review 仍 409。
    it("approved row consumes once, second consume affects zero, re-review stays 409 with stable fields", async () => {
      const { team, reviewerA, approval, suffix } = await seed();
      try {
        const service = buildReviewService({ accessPolicy: allowAll });
        const approved = await service.review(
          team.id,
          reviewerA.id,
          approval.id,
          {
            decision: "approved",
            reviewComment: "approved after review",
          },
        );
        expect(approved?.status).toBe("approved");

        const first = await repo.consume(team.id, approval.id);
        expect(first.count).toBe(1);
        const second = await repo.consume(team.id, approval.id);
        expect(second.count).toBe(0);

        // 已消费（已 approved）再审 → CAS status:pending 命中 0 → 409，行/消费字段稳定。
        await expect(
          service.review(team.id, reviewerA.id, approval.id, {
            decision: "rejected",
            reviewComment: "rejected after review",
          }),
        ).rejects.toThrow(ConflictException);

        const dbRow = await prisma.operationApproval.findUniqueOrThrow({
          where: { id: approval.id },
        });
        expect(dbRow.status).toBe("approved");
        expect(dbRow.reviewerId).toBe(reviewerA.id);
        expect(dbRow.consumedAt).toBeTruthy();
        // 仍只一条 decision audit。
        const audits = await prisma.auditEvent.findMany({
          where: {
            operationApprovalId: approval.id,
            action: { in: ["approval.approved", "approval.rejected"] },
          },
        });
        expect(audits).toHaveLength(1);
      } finally {
        await cleanup(suffix);
      }
    });
  },
);
