import { ConflictException, HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export interface ProjectIntakeErrorBody {
  code: string;
  message: string;
  action: string;
}

export function intakeError(
  code: string,
  message: string,
  action: string,
): ProjectIntakeErrorBody {
  return { code, message, action };
}

export function duplicateRepositoryError(): ConflictException {
  return new ConflictException(
    intakeError(
      "PROJECT_REPOSITORY_DUPLICATE",
      "该仓库已由当前团队的其他项目纳管",
      "请打开已有项目，或选择不同的仓库。",
    ),
  );
}

export function isPrismaUniqueError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function isRepositoryIdentityUniqueError(error: unknown): boolean {
  if (!isPrismaUniqueError(error)) return false;
  const target = (error as Prisma.PrismaClientKnownRequestError).meta?.target;
  const fields = Array.isArray(target)
    ? target.join(",")
    : String(target ?? "");
  return fields.includes("teamId") && fields.includes("canonicalKey");
}

export function isPrismaTransactionRetryable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ["P2034", "P2028"].includes(error.code)
  );
}

export function intakeErrorCode(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (response && typeof response === "object" && "code" in response) {
      const code = (response as { code?: unknown }).code;
      if (typeof code === "string") return code;
    }
  }
  return isPrismaUniqueError(error)
    ? "PROJECT_INTAKE_CONFLICT"
    : "PROJECT_INTAKE_FINALIZE_FAILED";
}
