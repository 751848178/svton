import 'reflect-metadata';
import type { Metadata } from 'next';
import { LocaleProvider } from '@svton/ui';
import { localeToLanguageTag } from '@svton/ui/i18n';
import { resolveWebLocale } from 'svton-web-locale-host';
import './globals.css';

export const metadata: Metadata = {
  title: 'Svton Agent',
  description: 'AI Agent powered by Svton',
  icons: {
    icon: '/favicon.svg',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await resolveWebLocale();
  return (
    <html lang={localeToLanguageTag(locale)} className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
