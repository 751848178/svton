/**
 * 服务器编辑表单
 *
 * 单一职责:渲染基本信息编辑态的全部输入(name/host/port/username/authType/credentials/tags)。
 * credentials 为只写字段(API 不回传明文):留空=不变,非空=替换重加密。
 */

'use client';

import { useTranslations } from 'next-intl';

export interface ServerEditFormValue {
  name: string;
  tags: string;
  host: string;
  port: string;
  username: string;
  authType: 'password' | 'key';
  credentials: string;
}

export function ServerEditForm({
  editForm,
  onEditFormChange,
}: {
  editForm: ServerEditFormValue;
  onEditFormChange: (patch: Partial<ServerEditFormValue>) => void;
}) {
  const t = useTranslations('servers');
  const tc = useTranslations('common');
  const inputCls = 'w-full rounded-md border px-3 py-2';

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{tc('name')}</span>
        <input
          value={editForm.name}
          onChange={(e) => onEditFormChange({ name: e.target.value })}
          className={inputCls}
        />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-2 block text-sm">
          <span className="mb-1 block font-medium">{t('host')}</span>
          <input
            value={editForm.host}
            onChange={(e) => onEditFormChange({ host: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('port')}</span>
          <input
            type="number"
            value={editForm.port}
            onChange={(e) => onEditFormChange({ port: e.target.value })}
            className={inputCls}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t('username')}</span>
        <input
          value={editForm.username}
          onChange={(e) => onEditFormChange({ username: e.target.value })}
          className={inputCls}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t('authType')}</span>
        <select
          value={editForm.authType}
          onChange={(e) => onEditFormChange({ authType: e.target.value as 'password' | 'key' })}
          className={inputCls}
        >
          <option value="password">{t('passwordAuth')}</option>
          <option value="key">{t('sshPrivateKey')}</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">
          {editForm.authType === 'password' ? t('password') : t('sshPrivateKey')}
        </span>
        {editForm.authType === 'password' ? (
          <input
            type="password"
            value={editForm.credentials}
            onChange={(e) => onEditFormChange({ credentials: e.target.value })}
            placeholder={t('credentialsChangeHint')}
            className={inputCls}
          />
        ) : (
          <textarea
            value={editForm.credentials}
            onChange={(e) => onEditFormChange({ credentials: e.target.value })}
            rows={4}
            placeholder={t('credentialsChangeHint')}
            className={`${inputCls} font-mono text-xs`}
          />
        )}
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t('tagsCommaSeparated')}</span>
        <input
          value={editForm.tags}
          onChange={(e) => onEditFormChange({ tags: e.target.value })}
          className={inputCls}
        />
      </label>
    </div>
  );
}
