/**
 * 域名配置 Hook
 *
 * 单一职责：管理域名配置状态、校验、Nginx/certbot 生成。
 * 用 useSetState 统一管理配置对象（@svton/hooks 优化）。
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSetState, usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { feedback } from '@/components/ui/feedback/feedback';
import { DEFAULT_DOMAIN_CONFIG, type DomainConfig } from '../types';

interface ValidationState {
  isValid: boolean;
  reason?: string;
}

export function useDomainConfig() {
  const t = useTranslations('domain');
  const [config, setConfig] = useSetState<DomainConfig>(DEFAULT_DOMAIN_CONFIG);
  const [generatedConfig, setGeneratedConfig] = useState('');
  const [certbotScript, setCertbotScript] = useState('');
  const [email, setEmail] = useState('');
  const [validation, setValidation] = useState<ValidationState | null>(null);
  const [generatingNginx, setGeneratingNginx] = useState(false);
  const [generatingCertbot, setGeneratingCertbot] = useState(false);
  const [error, setError] = useState('');

  const validateDomain = usePersistFn(async () => {
    if (!config.domain) return;
    try {
      setValidation(await apiRequest<ValidationState>(`GET:/domain/validate?domain=${config.domain}`));
    } catch {
      setValidation({ isValid: false, reason: t('validateFailed') });
    }
  });

  const generateNginxConfig = usePersistFn(async () => {
    setGeneratingNginx(true);
    setError('');
    try {
      const result = await apiRequest<{ configContent: string }>('POST:/domain/nginx-config', config);
      setGeneratedConfig(result.configContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('generateNginxFailed'));
    } finally {
      setGeneratingNginx(false);
    }
  });

  const generateCertbotScript = usePersistFn(async () => {
    if (!email) {
      feedback.error(t('emailRequired'));
      return;
    }
    setGeneratingCertbot(true);
    setError('');
    try {
      const result = await apiRequest<{ script: string }>('/domain/certbot-script', {
        domain: config.domain,
        email,
      });
      setCertbotScript(result.script);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('generateCertbotFailed'));
    } finally {
      setGeneratingCertbot(false);
    }
  });

  const clearError = usePersistFn(() => setError(''));

  return {
    config,
    setConfig,
    generatedConfig,
    certbotScript,
    email,
    setEmail,
    validation,
    validateDomain,
    generateNginxConfig,
    generateCertbotScript,
    generatingNginx,
    generatingCertbot,
    error,
    clearError,
  };
}

