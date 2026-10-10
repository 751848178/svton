import type { Metadata } from 'next';
import '@svton/ui/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shipkit · 发布工作台',
  description: '读取真实配置、Git 和 Agent 状态的本机发布控制平台。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
