/**
 * 日志中心状态管理
 *
 * 单一职责：集中声明所有日志中心的状态变量，供 use-logs 组合。
 * 拆出独立文件以保持状态声明清晰，避免 use-logs.ts 过长。
 */

import { useRef, useState } from 'react';
import type {
  Project,
  ApplicationItem,
  Server,
  Site,
  ManagedResource,
  BackupPlan,
  AlertEvent,
  DeploymentRun,
  TargetType,
  LogStats,
} from '../types';
import type {
  LogStream,
  LogEntry,
  LogCollectionRun,
  LogRetentionRun,
  LogStreamSession,
  LogTailResponse,
} from '../types-stream';

export function useLogsState() {
  const [streams, setStreams] = useState<LogStream[]>([]);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [collectionRuns, setCollectionRuns] = useState<LogCollectionRun[]>([]);
  const [retentionRuns, setRetentionRuns] = useState<LogRetentionRun[]>([]);
  const [streamSessions, setStreamSessions] = useState<LogStreamSession[]>([]);
  const [logStats, setLogStats] = useState<LogStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [resources, setResources] = useState<ManagedResource[]>([]);
  const [backupPlans, setBackupPlans] = useState<BackupPlan[]>([]);
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [deploymentRuns, setDeploymentRuns] = useState<DeploymentRun[]>([]);
  const [selectedStreamId, setSelectedStreamId] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('service');
  const [targetId, setTargetId] = useState('');
  const [streamName, setStreamName] = useState('');
  const [sourceKey, setSourceKey] = useState('');
  const [entryLevel, setEntryLevel] = useState<'info' | 'warn' | 'error'>('info');
  const [entryMessage, setEntryMessage] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appending, setAppending] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [error, setError] = useState('');

  const tailCursorRef = useRef<string | null>(null);
  const tailStreamSessionIdRef = useRef<string | null>(null);

  return {
    streams,
    setStreams,
    entries,
    setEntries,
    collectionRuns,
    setCollectionRuns,
    retentionRuns,
    setRetentionRuns,
    streamSessions,
    setStreamSessions,
    logStats,
    setLogStats,
    projects,
    setProjects,
    applications,
    setApplications,
    servers,
    setServers,
    sites,
    setSites,
    resources,
    setResources,
    backupPlans,
    setBackupPlans,
    alertEvents,
    setAlertEvents,
    deploymentRuns,
    setDeploymentRuns,
    selectedStreamId,
    setSelectedStreamId,
    targetType,
    setTargetType,
    targetId,
    setTargetId,
    streamName,
    setStreamName,
    sourceKey,
    setSourceKey,
    entryLevel,
    setEntryLevel,
    entryMessage,
    setEntryMessage,
    query,
    setQuery,
    loading,
    setLoading,
    saving,
    setSaving,
    appending,
    setAppending,
    collecting,
    setCollecting,
    error,
    setError,
    tailCursorRef,
    tailStreamSessionIdRef,
  };
}

export type LogsState = ReturnType<typeof useLogsState>;
