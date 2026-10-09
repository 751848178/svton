'use client';
import { useState } from 'react';
import { Modal } from '@svton/ui';
import { Select } from '@svton/ui';
import { useForm } from 'react-hook-form';
import { request } from '@/lib/api';
import type { Project, ProjectRegistration } from '@/lib/contracts';
import { registrationInput } from '@/lib/project-input';
import { ErrorMessage } from './primitives';
import { emptyRepository, repositoryInput } from '@/lib/repository-input';
import type { RepositoryInput, RepositoryPreview as Preview } from '@/lib/source-contracts';
import { RepositoryFields } from './repository-fields';
import { RepositoryPreview } from './repository-preview';

export function ProjectRegistrationModal({ open, onClose, onSaved }: {
  open: boolean; onClose: () => void; onSaved: (project: Project) => void;
}) {
  const [error, setError] = useState<unknown>(null);
  const [kind, setKind] = useState<'directory' | 'repository'>('repository');
  const [repository, setRepository] = useState<RepositoryInput>(emptyRepository);
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reading, setReading] = useState(false);
  const { register, handleSubmit, getValues, setValue, formState } = useForm<ProjectRegistration>({ shouldUnregister: true });
  const submit = handleSubmit(async values => {
    setError(null);
    try {
      if (kind === 'repository' && !preview) throw new Error('请先读取并核对仓库。');
      const input = kind === 'repository' ? { ...values, rootPath: undefined, sourceKind: kind, repository: repositoryInput(repository), expectedCommit: preview!.sourceSnapshot.commit, ...(token ? { token } : {}), ...(username.trim() ? { username: username.trim() } : {}) } : { ...values, sourceKind: kind };
      const project = await request('POST:/projects', registrationInput(input)); setToken(''); setUsername(''); onSaved(project); onClose();
    }
    catch (failure) { setError(failure); }
  });
  const read = async () => {
    setError(null); setReading(true); setPreview(null);
    try { setPreview(await request('POST:/repositories/preview', { repository: repositoryInput(repository), ...(token ? { token } : {}), ...(username.trim() ? { username: username.trim() } : {}) })); }
    catch (failure) { setError(failure); } finally { setReading(false); }
  };
  const busy = reading || formState.isSubmitting;
  const close = () => { setToken(''); setUsername(''); setPreview(null); setError(null); onClose(); };
  return <Modal open={open} onClose={busy ? () => {} : close} title="接入项目" description="从 Git 仓库读取源码，或绑定已有目录；运行连接使用已有控制端配置。" width={660} ariaCloseLabel="关闭项目接入" initialFocusSelector="[name=name]">
    <form className="config-form" onSubmit={submit}>
      <ErrorMessage error={error} />
      <label>项目名称<input {...register('name', { required: '请输入项目名称' })} autoComplete="off" />{formState.errors.name && <span className="form-error">{formState.errors.name.message}</span>}</label>
      <div className="select-field"><label htmlFor="project-source-kind">项目来源</label><Select id="project-source-kind" value={kind} onChange={event => { setKind(event.target.value as typeof kind); setPreview(null); setError(null); }} disabled={busy} options={[{ value: 'repository', label: 'Git 仓库 · 平台管理源码' }, { value: 'directory', label: '已有目录 · 使用本机源码' }]} /></div>
      {kind === 'repository' ? <><RepositoryFields value={repository} onChange={value => { setRepository(value); setPreview(null); }} token={token} onToken={value => { setToken(value); setPreview(null); }} username={username} onUsername={value => { setUsername(value); setPreview(null); }} disabled={busy} prefix="intake" /><button type="button" className={`button ${preview ? 'secondary' : 'primary'}`} disabled={busy || !repository.url.trim()} onClick={() => void read()}>{reading ? '正在读取仓库…' : preview ? '重新读取仓库' : '读取并核对仓库'}</button>{preview && <RepositoryPreview value={preview} />}</> : <label>本机项目目录<input {...register('rootPath', { required: kind === 'directory' ? '请输入项目目录' : false, pattern: { value: /^\//, message: '使用绝对路径' }, onBlur: () => { if (!getValues('configPath')) setValue('configPath', `${(getValues('rootPath') || '').replace(/\/$/, '')}/ship.config.yaml`); } })} placeholder="/Users/…/my-project" />
        <span className="form-help">目录需包含 ship.yaml 和可用的源码。</span>{formState.errors.rootPath && <span className="form-error">{formState.errors.rootPath.message}</span>}
      </label>}
      <label>控制端配置路径<input {...register('configPath', { required: '请输入配置路径', pattern: { value: /^\//, message: '使用绝对路径' } })} placeholder="/Users/…/ship.config.yaml" />
        <span className="form-help">只保存路径引用，私密配置与凭据不会进入网页。</span>{formState.errors.configPath && <span className="form-error">{formState.errors.configPath.message}</span>}
      </label>
      <label>运行目标<input {...register('targetKey')} placeholder="留空使用配置默认目标" /></label>
      <label>服务器显示名称<input {...register('serverName')} placeholder="便于识别的名称" /></label>
      <div className="form-actions"><button type="button" className="button secondary" onClick={close} disabled={busy}>取消</button><button className={`button ${kind === 'repository' && !preview ? 'secondary' : 'primary'}`} disabled={busy || (kind === 'repository' && !preview)}>{formState.isSubmitting ? '正在接入…' : '登记项目'}</button></div>
    </form>
  </Modal>;
}
