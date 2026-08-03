'use client';

import { Button } from '@/components/ui';

interface ReleaseCreateActionsProps {
  loading: boolean;
  canPreview: boolean;
  canCreate: boolean;
  onCancel: () => void;
  onPreview: () => void;
  onSubmit: () => void;
}

export function ReleaseCreateActions({
  loading,
  canPreview,
  canCreate,
  onCancel,
  onPreview,
  onSubmit,
}: ReleaseCreateActionsProps): JSX.Element {
  return (
    <div className="flex justify-end gap-2">
      <Button
        variant="outline"
        onClick={onCancel}
      >
        取消
      </Button>
      <Button
        variant="outline"
        onClick={onPreview}
        loading={loading}
        disabled={!canPreview || loading}
      >
        安全预览
      </Button>
      <Button
        onClick={onSubmit}
        loading={loading}
        disabled={!canCreate || loading}
      >
        创建正式发布
      </Button>
      {!canCreate && (
        <span className="self-center text-xs text-muted-foreground">
          {canPreview ? '请先完成安全预览' : '请先选择至少一个服务'}
        </span>
      )}
    </div>
  );
}
