import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

/**
 * next-intl 请求级配置。
 *
 * App Router 下 next-intl 通过此函数按请求加载 messages。
 * 默认 zh（项目主语言）；Header 写入 locale cookie 后按请求切换 zh/en。
 *
 * messages 直接来自 `messages/{locale}.json`。
 */
export default getRequestConfig(async () => {
  const requested = (await cookies()).get('locale')?.value;
  const locale = requested === 'en' ? 'en' : 'zh';
  const messages = (await import(`../../messages/${locale}.json`)).default as Record<string, unknown>;
  return {
    locale,
    messages,
  };
});
