'use client';

import { useState, useEffect, Suspense as ReactSuspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePersistFn } from '@svton/hooks';
import { Card } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import { useAuthStore } from '@/store/hooks';

// React 19 类型下 Suspense 跨包 JSX 校验差异（TS2786），用类型断言归一化（与 components/ui/modal.tsx 同范式）。
const Suspense = ReactSuspense as unknown as (props: {
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) => JSX.Element;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoading, isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const redirect = searchParams.get('redirect') || '/projects';

  useEffect(() => {
    if (isAuthenticated) router.push(redirect);
  }, [isAuthenticated, redirect, router]);

  const handleSubmit = usePersistFn(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login({ email, password });
      router.push(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    }
  });

  return (
    <Card className="w-full max-w-md p-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold">登录</h1>
        <p className="mt-2 text-muted-foreground">登录到 Devpilot</p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {error ? (
          <ErrorBanner
            message={error}
            variant="inline"
          />
        ) : null}
        <label className="block text-sm">
          <span className="mb-1 block font-medium">邮箱</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="your@email.com"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">密码</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="••••••••"
          />
        </label>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-md bg-primary py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading ? '登录中...' : '登录'}
        </button>
      </form>
      <div className="mt-6 text-center text-sm">
        <span className="text-muted-foreground">还没有账号？</span>{' '}
        <Link
          href="/register"
          className="text-primary hover:underline"
        >
          注册
        </Link>
      </div>
      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">或使用第三方登录</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <button
            type="button"
            className="flex items-center justify-center rounded-md border px-4 py-2 transition-colors hover:bg-accent"
          >
            GitHub
          </button>
          <button
            type="button"
            className="flex items-center justify-center rounded-md border px-4 py-2 transition-colors hover:bg-accent"
          >
            GitLab
          </button>
          <button
            type="button"
            className="flex items-center justify-center rounded-md border px-4 py-2 transition-colors hover:bg-accent"
          >
            Gitee
          </button>
        </div>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
