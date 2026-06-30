'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePersistFn } from '@svton/hooks';
import { Card } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import { useAuthStore } from '@/store/hooks';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading, isAuthenticated } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) router.push('/projects');
  }, [isAuthenticated, router]);

  const handleSubmit = usePersistFn(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    if (password.length < 6) {
      setError('密码至少 6 个字符');
      return;
    }
    try {
      await register({ email, password, name: name || undefined });
      router.push('/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">注册</h1>
          <p className="mt-2 text-muted-foreground">创建你的 Devpilot 账号</p>
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
            <span className="mb-1 block font-medium">
              昵称 <span className="text-muted-foreground">(可选)</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="你的昵称"
            />
          </label>
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
              placeholder="至少 6 个字符"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">确认密码</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="再次输入密码"
            />
          </label>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-primary py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? '注册中...' : '注册'}
          </button>
        </form>
        <div className="mt-6 text-center text-sm">
          <span className="text-muted-foreground">已有账号？</span>{' '}
          <Link
            href="/login"
            className="text-primary hover:underline"
          >
            登录
          </Link>
        </div>
      </Card>
    </div>
  );
}
