import { ConflictException, UnprocessableEntityException } from "@nestjs/common";

export interface RepositoryIdentityErrorDetail {
  code: string;
  message: string;
  action: string;
}

export function identityConflict(
  code: string,
  message: string,
  action: string,
): ConflictException {
  return new ConflictException({ code, message, action });
}

export function identityUnavailable(
  code: string,
  message: string,
  action: string,
): UnprocessableEntityException {
  return new UnprocessableEntityException({ code, message, action });
}
