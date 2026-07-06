import { getRequestConfig } from 'next-intl/server';

/**
 * next-intl 请求级配置。
 *
 * App Router 下 next-intl 通过此函数按请求加载 messages。
 * 当前默认 zh（项目主语言）；locale 来源可后续扩展为 cookie/header/url。
 */
export default getRequestConfig(async () => {
  const locale = 'zh';
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return {
    locale,
    messages,
  };
});
