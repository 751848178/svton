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
}

export function useDomainConfig() {
  const t = useTranslations('domain');
  const [config, setConfig] = useSetState<DomainConfig>(DEFAULT_DOMAIN_CONFIG);
  const [generatedConfig, setGeneratedConfig] = useState('');
  const [certbotScript, setCertbotScript] = useState('');
  const [email, setEmail] = useState('');
  const [validation, setValidation] = useState<ValidationState | null>(null);

  const validateDomain = usePersistFn(async () => {
    if (!config.domain) return;
    try {
      setValidation(await apiRequest<ValidationState>(`GET:/domain/validate?domain=${config.domain}`));
    } catch {
      setValidation({ isValid: false });
    }
  });

  const generateNginxConfig = usePersistFn(async () => {
    try {
      const result = await apiRequest<{ configContent: string }>('POST:/domain/nginx-config', config);
      setGeneratedConfig(result.configContent);
    } catch (error) {
      console.error('Failed to generate config:', error);
    }
  });

  const generateCertbotScript = usePersistFn(async () => {
    if (!email) {
      feedback.error(t('emailRequired'));
      return;
    }
    try {
      const result = await apiRequest<{ script: string }>('/domain/certbot-script', {
        domain: config.domain,
        email,
      });
      setCertbotScript(result.script);
    } catch (error) {
      console.error('Failed to generate script:', error);
    }
  });

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
  };
}
