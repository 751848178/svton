import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { ListDeploymentRunsQueryDto } from "./dto/deployment.dto";

describe("ListDeploymentRunsQueryDto", () => {
  it("accepts persisted statuses and parses the attention-first flag", () => {
    const query = plainToInstance(ListDeploymentRunsQueryDto, {
      status: "completed",
      attentionFirst: "true",
      skip: "0",
      take: "21",
    });
    expect(validateSync(query)).toHaveLength(0);
    expect(query).toMatchObject({
      status: "completed",
      attentionFirst: true,
      skip: 0,
      take: 21,
    });
  });

  it("rejects the non-persisted succeeded status", () => {
    const query = plainToInstance(ListDeploymentRunsQueryDto, {
      status: "succeeded",
    });
    expect(
      validateSync(query).some((error) => error.property === "status"),
    ).toBe(true);
  });
});
