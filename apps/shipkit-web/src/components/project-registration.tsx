'use client';
import { useState } from 'react';
import { Modal } from '@svton/ui';
import { useForm } from 'react-hook-form';
import { request } from '@/lib/api';
import type { Project, ProjectRegistration } from '@/lib/contracts';
import { registrationInput } from '@/lib/project-input';
import { ErrorMessage } from './primitives';

export function ProjectRegistrationModal({ open, onClose, onSaved }: {
  open: boolean; onClose: () => void; onSaved: (project: Project) => void;
}) {
  const [error, setError] = useState<unknown>(null);
  const { register, handleSubmit, getValues, setValue, formState } = useForm<ProjectRegistration>();
  const submit = handleSubmit(async values => {
    setError(null);
    try { const project = await request('POST:/projects', registrationInput(values)); onSaved(project); onClose(); }
    catch (failure) { setError(failure); }
  });
  return <Modal open={open} onClose={formState.isSubmitting ? () => {} : onClose} title="注册本机项目" description="绑定已有项目目录与配置文件，配置内容由本机后台读取。" width={560} ariaCloseLabel="关闭注册项目" initialFocusSelector="[name=name]">
    <form className="config-form" onSubmit={submit}>
      <ErrorMessage error={error} />
      <label>项目名称<input {...register('name', { required: '请输入项目名称' })} autoComplete="off" />{formState.errors.name && <span className="form-error">{formState.errors.name.message}</span>}</label>
      <label>本机项目目录<input {...register('rootPath', { required: '请输入项目目录', pattern: { value: /^\//, message: '使用绝对路径' }, onBlur: () => { if (!getValues('configPath')) setValue('configPath', `${getValues('rootPath').replace(/\/$/, '')}/ship.config.yaml`); } })} placeholder="/Users/…/my-project" />
        <span className="form-help">目录需包含 ship.yaml 和可用的源码。</span>{formState.errors.rootPath && <span className="form-error">{formState.errors.rootPath.message}</span>}
      </label>
      <label>控制端配置路径<input {...register('configPath', { required: '请输入配置路径', pattern: { value: /^\//, message: '使用绝对路径' } })} placeholder="/Users/…/ship.config.yaml" />
        <span className="form-help">只保存路径引用，私密配置与凭据不会进入网页。</span>{formState.errors.configPath && <span className="form-error">{formState.errors.configPath.message}</span>}
      </label>
      <label>运行目标<input {...register('targetKey')} placeholder="留空使用配置默认目标" /></label>
      <label>服务器显示名称<input {...register('serverName')} placeholder="便于识别的名称" /></label>
      <div className="form-actions"><button type="button" className="button secondary" onClick={onClose} disabled={formState.isSubmitting}>取消</button><button className="button primary" disabled={formState.isSubmitting}>{formState.isSubmitting ? '正在注册…' : '注册项目'}</button></div>
    </form>
  </Modal>;
}
