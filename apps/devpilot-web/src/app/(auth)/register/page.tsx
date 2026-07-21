'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Card } from '@svton/ui';
import { ErrorBanner } from '@/components/ui';
import { useAuthStore } from '@/store/hooks';

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const { register, isLoading, isAuthenticated } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) router.push('/dashboard');
  }, [isAuthenticated, router]);

  const handleSubmit = usePersistFn(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }
    if (password.length < 6) {
      setError(t('passwordTooShort'));
      return;
    }
    try {
      await register({ email, password, name: name || undefined });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('registerFailed'));
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">{t('registerTitle')}</h1>
          <p className="mt-2 text-muted-foreground">{t('registerSubtitle')}</p>
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
              {t('nickname')} <span className="text-muted-foreground">({tc('optional')})</span>
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('nicknamePlaceholder')}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('email')}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('emailPlaceholder')}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('password')}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('passwordPlaceholder')}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('confirmPassword')}</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('confirmPasswordPlaceholder')}
            />
          </label>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-primary py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? t('registerLoading') : t('registerSubmit')}
          </button>
        </form>
        <div className="mt-6 text-center text-sm">
          <span className="text-muted-foreground">{t('hasAccount')}</span>{' '}
          <Link
            href="/login"
            className="text-primary hover:underline"
          >
            {t('loginLink')}
          </Link>
        </div>
      </Card>
    </div>
  );
}
