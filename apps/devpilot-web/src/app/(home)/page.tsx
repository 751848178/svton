'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';

export default function HomePage() {
  const { isAuthenticated, user } = useAuthStore();

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center py-24 px-4">
        <div className="text-center max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Devpilot
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            可视化创建基于 Svton 技术栈的全栈应用项目，自动配置功能模块和资源凭证
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/projects/new"
              className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              创建新项目
            </Link>
            {!isAuthenticated && (
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-md border px-8 py-3 text-sm font-medium transition-colors hover:bg-accent"
              >
                登录
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">核心功能</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              title="可视化配置"
              description="通过向导式界面配置项目，选择子项目类型、功能模块和资源"
            />
            <FeatureCard
              title="自动依赖解析"
              description="选择功能后自动添加对应的 svton 包和配置代码"
            />
            <FeatureCard
              title="资源凭证管理"
              description="安全存储数据库、缓存、存储等资源凭证，一键应用到项目"
            />
            <FeatureCard
              title="配置预设"
              description="保存常用配置为预设，快速创建相似项目"
            />
            <FeatureCard
              title="多子项目支持"
              description="支持 Backend (NestJS)、Admin (Next.js)、Mobile (Taro) 子项目"
            />
            <FeatureCard
              title="即时下载"
              description="生成完整项目结构，打包为 ZIP 文件即时下载"
            />
          </div>
        </div>
      </section>

      {/* Quick Start Section */}
      {isAuthenticated && (
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">
              欢迎回来，{user?.name || user?.email}
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              <QuickLink href="/projects/new" title="创建项目" description="开始新项目配置" />
              <QuickLink href="/resources" title="资源管理" description="管理资源凭证" />
              <QuickLink href="/presets" title="配置预设" description="查看保存的预设" />
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 rounded-lg border bg-card">
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="p-4 rounded-lg border hover:border-primary transition-colors"
    >
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
