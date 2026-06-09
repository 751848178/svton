import 'reflect-metadata';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Svton Agent',
  description: 'AI Agent powered by Svton',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
