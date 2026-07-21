'use client';

/**
 * 全站统一反馈入口（toast 封装）
 *
 * 基于 sonner，向业务层暴露稳定的 feedback API，
 * 并行任务统一从 @/components/ui/feedback/feedback import。
 *
 * 单一职责：成功 / 失败 / 异步过程 三类反馈，无业务逻辑。
 */

import { toast } from 'sonner';

interface FeedbackOptions {
  description?: string;
}

interface PromiseMessages {
  loading: string;
  success: string;
  error: string;
}

export const feedback: {
  success(message: string, opts?: FeedbackOptions): void;
  error(message: string, opts?: FeedbackOptions): void;
  promise<T>(p: Promise<T>, msgs: PromiseMessages): void;
} = {
  success(message, opts) {
    toast.success(message, { description: opts?.description });
  },
  error(message, opts) {
    toast.error(message, { description: opts?.description });
  },
  promise(p, msgs) {
    toast.promise(p, {
      loading: msgs.loading,
      success: msgs.success,
      error: msgs.error,
    });
  },
};
