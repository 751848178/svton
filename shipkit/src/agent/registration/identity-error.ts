export class RegistrationIdentityError extends Error {
  readonly code: string;
  constructor(code: string) {
    super('Agent 登记身份不可用，请检查登记配置与持久数据');
    this.name = 'RegistrationIdentityError';
    this.code = code;
  }
}
export function identityFault(code: string): never { throw new RegistrationIdentityError(code); }
