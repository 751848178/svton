/**
 * 发布提交编排 Hook（第 0 步）
 *
 * 单一职责：执行「创建发布单 → 触发构建 → 等待构建成功 → 自动部署预发」
 * 的链式编排；制品自动取最新成功构建，用户不选择。每段失败暴露失败阶段
 * 与原始错误（组件层翻译成人话），支持从失败阶段重试。
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type {
  CreateReleaseOrderInput,
  ReleaseBuildItem,
  ReleaseBuildListResponse,
  ReleaseOrderDetail,
  ReleaseStagingDeploymentItem,
} from '../../types/release-order.types';

export type PublishSubmitPhase = 'idle' | 'creating' | 'building' | 'deploying' | 'succeeded';
export type PublishFailedStage = 'create' | 'build' | 'deploy' | null;

const BUILD_POLL_INTERVAL_MS = 5_000;
const BUILD_POLL_MAX_ATTEMPTS = 120; // 10 分钟

export interface PublishSubmitState {
  phase: PublishSubmitPhase;
  failedStage: PublishFailedStage;
  error: string;
  releaseOrderId: string | null;
}

export function usePublishSubmit(projectId: string) {
  const [state, setState] = useState<PublishSubmitState>(() => idleState());
  const runToken = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      runToken.current += 1;
    };
  }, []);

  const submit = useCallback(
    async (input: CreateReleaseOrderInput) => {
      runToken.current += 1;
      const token = runToken.current;
      setState({ phase: 'creating', failedStage: null, error: '', releaseOrderId: null });
      let releaseOrderId: string | null = null;
      try {
        const order = await apiRequest<ReleaseOrderDetail>(
          `POST:/projects/${encodeURIComponent(projectId)}/delivery/releases`,
          input,
        );
        releaseOrderId = order.id;
        tokenGuard(token, () =>
          setState({ phase: 'building', failedStage: null, error: '', releaseOrderId }),
        );
      } catch (caught) {
        return fail(token, 'create', message(caught), null);
      }
      return await buildAndDeploy(token, projectId, releaseOrderId);
    },
    [projectId],
  );

  /** 从失败阶段重试：创建失败从头开始；构建/部署失败基于既有发布单续跑。 */
  const retry = useCallback(
    async (input: CreateReleaseOrderInput) => {
      if (state.failedStage === 'build' || state.failedStage === 'deploy') {
        if (!state.releaseOrderId) return submit(input);
        runToken.current += 1;
        const token = runToken.current;
        setState({
          phase: 'building',
          failedStage: null,
          error: '',
          releaseOrderId: state.releaseOrderId,
        });
        return await buildAndDeploy(token, projectId, state.releaseOrderId);
      }
      return submit(input);
    },
    [projectId, state.failedStage, state.releaseOrderId, submit],
  );

  const reset = useCallback(() => {
    runToken.current += 1;
    setState(idleState());
  }, []);

  return {
    ...state,
    working: state.phase !== 'idle' && state.phase !== 'succeeded',
    submit,
    retry,
    reset,
  };

  function fail(token: number, stage: PublishFailedStage, error: string, roid: string | null) {
    tokenGuard(token, () =>
      setState({ phase: 'idle', failedStage: stage, error, releaseOrderId: roid }),
    );
    return null;
  }

  async function buildAndDeploy(token: number, pid: string, roid: string): Promise<string | null> {
    // 已有成功制品（如重试部署）则直接复用，不再重复构建。
    let manifestId = await peekSucceededManifest(pid, roid).catch(() => null);
    if (!manifestId) {
      try {
        await apiRequest<ReleaseBuildItem>(
          `POST:/projects/${pid}/delivery/releases/${roid}/builds`,
          {},
        );
      } catch (caught) {
        return fail(token, 'build', message(caught), roid);
      }
      manifestId = await waitForSucceededManifest(token, pid, roid);
      if (!manifestId) {
        const latest = await latestBuild(pid, roid).catch(() => null);
        const reason = latest?.errorMessage || latest?.errorCode || message(null);
        if (!alive.current || runToken.current !== token) return null;
        return fail(token, 'build', reason, roid);
      }
    }
    tokenGuard(token, () =>
      setState((current) =>
        current.releaseOrderId === roid ? { ...current, phase: 'deploying' } : current,
      ),
    );
    try {
      await apiRequest<ReleaseStagingDeploymentItem>(
        `POST:/projects/${pid}/delivery/releases/${roid}/staging-deployments`,
        { manifestId },
      );
    } catch (caught) {
      return fail(token, 'deploy', message(caught), roid);
    }
    tokenGuard(token, () => setState((current) => ({ ...current, phase: 'succeeded' })));
    return roid;
  }

  async function waitForSucceededManifest(token: number, pid: string, roid: string) {
    for (let attempt = 0; attempt < BUILD_POLL_MAX_ATTEMPTS; attempt += 1) {
      if (!alive.current || runToken.current !== token) return null;
      const builds = await latestBuilds(pid, roid);
      const succeeded = builds.find((build) => build.status === 'succeeded' && build.manifest);
      if (succeeded?.manifest) return succeeded.manifest.id;
      const terminalFailure = builds.find(
        (build) => build.status === 'failed' || build.status === 'canceled',
      );
      if (terminalFailure) return null;
      await sleep(BUILD_POLL_INTERVAL_MS);
    }
    return null;
  }

  function tokenGuard(token: number, apply: () => void) {
    if (alive.current && runToken.current === token) apply();
  }
}

async function peekSucceededManifest(pid: string, roid: string): Promise<string | null> {
  const builds = await latestBuilds(pid, roid);
  const build = builds.find((item) => item.status === 'succeeded' && item.manifest);
  return build?.manifest?.id ?? null;
}

function idleState(): PublishSubmitState {
  return { phase: 'idle', failedStage: null, error: '', releaseOrderId: null };
}

async function latestBuilds(pid: string, roid: string): Promise<ReleaseBuildItem[]> {
  const result = await apiRequest<ReleaseBuildListResponse>(
    `GET:/projects/${pid}/delivery/releases/${roid}/builds?take=10`,
  );
  return result.items;
}

async function latestBuild(pid: string, roid: string): Promise<ReleaseBuildItem | null> {
  const items = await latestBuilds(pid, roid);
  return items[0] ?? null;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : error ? String(error) : '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
