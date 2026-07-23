'use client';

import { useState, useEffect, Suspense as ReactSuspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Card } from '@svton/ui';
import { Button, ErrorBanner, Input } from '@/components/ui';
import { useAuthStore } from '@/store/hooks';
import { toSafeRedirectPath } from '@/lib/auth/redirect-path.utils';

// React 19 类型下 Suspense 跨包 JSX 校验差异（TS2786），用类型断言归一化（与 components/ui/modal.tsx 同范式）。
const Suspense = ReactSuspense as unknown as (props: {
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) => JSX.Element;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('auth');
  const { login, isLoading, isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const redirect = toSafeRedirectPath(searchParams.get('redirect'));

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
      setError(err instanceof Error ? err.message : t('loginFailed'));
    }
  });

  return (
    <Card className="w-full max-w-md p-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold">{t('loginTitle')}</h1>
        <p className="mt-2 text-muted-foreground">{t('loginSubtitle', { brand: 'Devpilot' })}</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? <ErrorBanner message={error} variant="inline" /> : null}
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('email')}</span>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder={t('emailPlaceholder')}
          />
        </label>
        <div className="flex items-center justify-end">
          {/* TODO: 接入「重置密码」流程后替换 href；当前为占位链接，无状态副作用。 */}
          <Link href="#" className="text-sm text-muted-foreground hover:text-primary hover:underline">
            {t('forgotPassword')}
          </Link>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('password')}</span>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
        </label>
        <Button type="submit" block loading={isLoading}>
          {isLoading ? t('loginLoading') : t('loginSubmit')}
        </Button>
      </form>
      <div className="mt-6 text-center text-sm">
        <span className="text-muted-foreground">{t('noAccount')}</span>{' '}
        <Link href="/register" className="text-primary hover:underline">
          {t('registerLink')}
        </Link>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
