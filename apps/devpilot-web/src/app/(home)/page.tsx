import Link from 'next/link';
import { Card } from '@svton/ui';
import { HomeGreeting } from './HomeGreeting';

/**
 * 首页 — Server Component。
 *
 * 静态营销内容在 server 渲染；登录态相关的「欢迎回来」区块由 client HomeGreeting 承担。
 */
export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="flex flex-col items-center justify-center px-4 py-24">
        <div className="max-w-3xl text-center">
          <h1 className="mb-4 text-4xl font-bold md:text-5xl">Devpilot</h1>
          <p className="mb-8 text-lg text-muted-foreground">
            可视化创建基于 Svton 技术栈的全栈应用项目，自动配置功能模块和资源凭证
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/projects/new"
              className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              创建新项目
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md border px-8 py-3 text-sm font-medium transition-colors hover:bg-accent"
            >
              登录
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-muted/30 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-2xl font-bold">核心功能</h2>
          <div className="grid gap-8 md:grid-cols-3">
            <Card title="可视化配置">
              <p className="text-sm text-muted-foreground">
                通过向导式界面配置项目，选择子项目类型、功能模块和资源
              </p>
            </Card>
            <Card title="自动依赖解析">
              <p className="text-sm text-muted-foreground">选择功能后自动添加对应的 svton 包和配置代码</p>
            </Card>
            <Card title="资源凭证管理">
              <p className="text-sm text-muted-foreground">
                安全存储数据库、缓存、存储等资源凭证，一键应用到项目
              </p>
            </Card>
            <Card title="配置预设">
              <p className="text-sm text-muted-foreground">保存常用配置为预设，快速创建相似项目</p>
            </Card>
            <Card title="多子项目支持">
              <p className="text-sm text-muted-foreground">
                支持 Backend (NestJS)、Admin (Next.js)、Mobile (Taro) 子项目
              </p>
            </Card>
            <Card title="即时下载">
              <p className="text-sm text-muted-foreground">
                生成完整项目结构，打包为 ZIP 文件即时下载
              </p>
            </Card>
          </div>
        </div>
      </section>

      <HomeGreeting />
    </main>
  );
}
