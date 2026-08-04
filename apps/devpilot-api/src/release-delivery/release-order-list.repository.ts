import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  releaseOrderListCountQuery,
  releaseOrderListRowsQuery,
} from "./release-order-list.query";
import {
  count,
  presentReleaseOrderListRow,
  type ReleaseOrderListRow,
} from "./release-order-list.presenter";
import type {
  ReleaseOrderListQueryInput,
  ReleaseOrderListResult,
} from "./release-order-list.types";

interface CountRow {
  total: bigint | number;
}

@Injectable()
export class ReleaseOrderListRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(input: ReleaseOrderListQueryInput): Promise<ReleaseOrderListResult> {
    return this.prisma.$transaction(
      async (transaction) => {
        const totals = await transaction.$queryRaw<CountRow[]>(
          releaseOrderListCountQuery(input),
        );
        const rows = await transaction.$queryRaw<ReleaseOrderListRow[]>(
          releaseOrderListRowsQuery(input),
        );
        return {
          items: rows.map(presentReleaseOrderListRow),
          total: count(totals[0]?.total ?? 0),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
