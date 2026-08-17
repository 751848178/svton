import { headers } from 'next/headers';
import { resolveAcceptLanguage, type Locale } from '@svton/ui/i18n';

/** Default request-capable host. Static builds replace this module at bundle time. */
export async function resolveWebLocale(): Promise<Locale> {
  const requestHeaders = await headers();
  return resolveAcceptLanguage(requestHeaders.get('accept-language'));
}
