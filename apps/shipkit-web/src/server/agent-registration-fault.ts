const faults = {
  AGENT_GATEWAY_DISABLED: [503, '机器登记入口未启用'],
  AGENT_GATEWAY_CONFIGURATION: [503, '机器登记网关配置不可用'],
  AGENT_GATEWAY_REJECTED: [403, '机器登记请求入口不符合要求'],
  AGENT_GATEWAY_METHOD: [405, '机器登记入口仅支持 POST'],
  AGENT_GATEWAY_BODY_LIMIT: [413, '机器登记请求超过大小限制'],
  AGENT_GATEWAY_BODY_INVALID: [400, '机器登记请求必须为有效 JSON 对象'],
  AGENT_GATEWAY_UPSTREAM: [502, '机器登记服务响应不可用'],
  AGENT_GATEWAY_DEADLINE: [504, '机器登记请求超时，请保留原请求后重试'],
  AGENT_GATEWAY_ABORTED: [408, '机器登记请求已中断'],
} as const;
export class AgentGatewayFault extends Error {
  readonly status: number;
  constructor(readonly code: keyof typeof faults) {
    super(faults[code][1]); this.status = faults[code][0];
  }
}
export function gatewayFailure(error: unknown): Response {
  const fault = error instanceof AgentGatewayFault ? error : new AgentGatewayFault('AGENT_GATEWAY_UPSTREAM');
  return Response.json({ code: fault.code, message: fault.message }, {
    status: fault.status, headers: { 'cache-control': 'no-store' },
  });
}
