export const PAYMENT_OPTIONS = 'PAYMENT_OPTIONS';

export const WECHAT_PAY_ENDPOINTS = {
  // 统一下单
  UNIFIED_ORDER: 'https://api.mch.weixin.qq.com/v3/pay/transactions',
  // 查询订单
  QUERY_ORDER: 'https://api.mch.weixin.qq.com/v3/pay/transactions',
  // 关闭订单
  CLOSE_ORDER: 'https://api.mch.weixin.qq.com/v3/pay/transactions',
  // 退款
  REFUND: 'https://api.mch.weixin.qq.com/v3/refund/domestic/refunds',
} as const;

export const ALIPAY_ENDPOINTS = {
  GATEWAY: 'https://openapi.alipay.com/gateway.do',
  GATEWAY_SANDBOX: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
} as const;
