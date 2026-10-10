import { HttpException } from '@nestjs/common';

const faults = {
  REGISTRATION_INPUT_INVALID: [400, '注册协议参数无效，请使用受支持的客户端'],
  TEMPORARY_AGENT_ENROLLMENT_UNSUPPORTED: [400, '临时 Agent 注册尚未开放，请使用现有构建机配置'],
  REGISTRATION_UNAUTHORIZED: [401, '注册凭据无效、已撤销或不属于当前身份'],
  REGISTRATION_EXPIRED: [410, '注册码或响应恢复期已结束，请重新签发'],
  REGISTRATION_CONFLICT: [409, '注册请求与已保存身份不一致，请核对本机注册台账'],
  AGENT_NOT_FOUND: [404, 'Agent 资源不存在或不属于当前工作空间'],
  AGENT_SESSION_CONFLICT: [409, 'Agent 会话已变化或仍被另一进程占用，请重新核对会话'],
  AGENT_SEQUENCE_CONFLICT: [409, '心跳顺序或内容不一致，请恢复原请求后重试'],
  AGENT_SESSION_EXPIRED: [409, 'Agent 会话租约已结束，请重新建立会话'],
  AGENT_COUNTER_EXHAUSTED: [409, 'Agent 身份计数已达到上限，需要受控重新登记'],
  AGENT_CLOCK_INVALID: [409, '服务器时间早于已记录的会话，请先恢复服务器时间'],
  AGENT_STATE_CONFLICT: [409, 'Agent 状态或凭据版本已变化，请刷新后重试'],
  REGISTRATION_BUSY: [503, '注册状态暂时繁忙，请保留原请求后重试'],
} as const;

export type RegistrationFaultCode = keyof typeof faults;
export function registrationFault(code: RegistrationFaultCode): never {
  const [status, message] = faults[code];
  throw new HttpException({ code, message }, status);
}

export function parseRegistrationInput<T>(parse: (body: unknown) => T, body: unknown): T {
  try { return parse(body); } catch { return registrationFault('REGISTRATION_INPUT_INVALID'); }
}
