import React, { useState } from 'react';

// ════════════════════════════════════════════════════════════
// AgentEditorPanel — create and edit custom agent definitions
// ════════════════════════════════════════════════════════════

export interface AgentDefinitionData {
  name: string;
  title: string;
  description: string;
  model?: string;
  systemPrompt?: string;
  tools?: string[];
  permissions?: string;
  color?: string;
}

export interface AgentEditorPanelProps {
  agents: AgentDefinitionData[];
  onSave: (agent: AgentDefinitionData) => void;
  onDelete: (name: string) => void;
}

const PERMISSION_OPTIONS = [
  { value: 'read_only', label: '只读' },
  { value: 'default', label: '默认' },
  { value: 'accept_edits', label: '接受编辑' },
  { value: 'auto', label: '全自动' },
];

const PRESET_COLORS = [
  '#06b6d4',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#3b82f6',
  '#6b7280',
];

const EMPTY_FORM: AgentDefinitionData = {
  name: '',
  title: '',
  description: '',
  model: '',
  systemPrompt: '',
  tools: [],
  permissions: 'default',
  color: '#06b6d4',
};

export function AgentEditorPanel({ agents, onSave, onDelete }: AgentEditorPanelProps) {
  const [editingAgent, setEditingAgent] = useState<AgentDefinitionData | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [originalName, setOriginalName] = useState<string | null>(null);

  const startCreate = () => {
    setEditingAgent({ ...EMPTY_FORM });
    setIsNew(true);
    setOriginalName(null);
  };

  const startEdit = (agent: AgentDefinitionData) => {
    setEditingAgent({ ...agent });
    setIsNew(false);
    setOriginalName(agent.name);
  };

  const cancelEdit = () => {
    setEditingAgent(null);
    setIsNew(false);
    setOriginalName(null);
  };

  const handleSave = () => {
    if (!editingAgent || !editingAgent.name.trim()) return;
    onSave(editingAgent);
    cancelEdit();
  };

  const handleDelete = (name: string) => {
    onDelete(name);
    if (originalName === name) {
      cancelEdit();
    }
  };

  const updateField = <K extends keyof AgentDefinitionData>(
    key: K,
    value: AgentDefinitionData[K],
  ) => {
    setEditingAgent((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  // ── Styles ──

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 500,
    color: '#ffffff',
    marginBottom: '4px',
  };

  const sectionDescStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: '24px',
  };

  const headerRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  };

  const createButtonStyle: React.CSSProperties = {
    padding: '7px 14px',
    fontSize: '11px',
    fontWeight: 600,
    borderRadius: '8px',
    border: '1px solid #333333',
    background: '#222222',
    color: '#d1d5db',
    cursor: 'pointer',
    transition: 'border-color 150ms ease, color 150ms ease',
  };

  const agentListCardStyle: React.CSSProperties = {
    background: '#1c1c1c',
    borderRadius: '12px',
    border: '1px solid #2a2a2a',
    overflow: 'hidden',
  };

  const agentRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderBottom: '1px solid #2a2a2a',
  };

  const colorDotStyle = (color: string): React.CSSProperties => ({
    width: '10px',
    height: '10px',
    borderRadius: '9999px',
    background: color || '#6b7280',
    flexShrink: 0,
  });

  const agentNameStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e5e7eb',
  };

  const agentTitleStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#6b7280',
  };

  const actionButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '11px',
    color: '#6b7280',
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'color 150ms ease',
  };

  const formCardStyle: React.CSSProperties = {
    background: '#1c1c1c',
    borderRadius: '12px',
    border: '1px solid rgba(14,116,144,0.4)',
    padding: '20px',
    marginBottom: '16px',
  };

  const formTitleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#22d3ee',
    marginBottom: '16px',
  };

  const fieldGroupStyle: React.CSSProperties = {
    marginBottom: '14px',
  };

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    display: 'block',
    marginBottom: '6px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    fontSize: '13px',
    background: '#222222',
    border: '1px solid #333333',
    borderRadius: '8px',
    color: '#e5e7eb',
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: '100px',
    resize: 'vertical' as const,
    fontFamily: 'monospace',
    fontSize: '12px',
    lineHeight: 1.5,
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'none' as const,
  };

  const buttonRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginTop: '20px',
  };

  const saveButtonStyle: React.CSSProperties = {
    padding: '8px 18px',
    fontSize: '12px',
    fontWeight: 600,
    borderRadius: '8px',
    border: 'none',
    background: '#0891b2',
    color: '#ffffff',
    cursor: 'pointer',
    transition: 'background 150ms ease',
  };

  const cancelButtonStyle: React.CSSProperties = {
    padding: '8px 18px',
    fontSize: '12px',
    fontWeight: 500,
    borderRadius: '8px',
    border: '1px solid #333333',
    background: 'transparent',
    color: '#6b7280',
    cursor: 'pointer',
    transition: 'color 150ms ease, border-color 150ms ease',
  };

  const colorPickerRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    alignItems: 'center',
  };

  const colorSwatchStyle = (isActive: boolean): React.CSSProperties => ({
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    cursor: 'pointer',
    border: isActive ? '2px solid #ffffff' : '2px solid transparent',
    transition: 'border 150ms ease',
    padding: 0,
  });

  const emptyStateStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '32px 16px',
    color: '#6b7280',
    fontSize: '13px',
  };

  return (
    <div>
      <h2 style={sectionTitleStyle}>自定义 Agent</h2>
      <p style={sectionDescStyle}>创建和管理自定义 Agent 定义。</p>

      <div style={headerRowStyle}>
        <span />
        {!editingAgent && (
          <button
            type="button"
            style={createButtonStyle}
            onClick={startCreate}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#6b7280';
              (e.currentTarget as HTMLButtonElement).style.color = '#ffffff';
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#333333';
              (e.currentTarget as HTMLButtonElement).style.color = '#d1d5db';
            }}
          >
            + 创建新 Agent
          </button>
        )}
      </div>

      {/* Edit / Create form */}
      {editingAgent && (
        <div style={formCardStyle}>
          <div style={formTitleStyle}>
            {isNew ? '创建新 Agent' : `编辑: ${originalName}`}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '14px',
            }}
          >
            <div style={fieldGroupStyle}>
              <label style={fieldLabelStyle}>名称 (唯一标识)</label>
              <input
                type="text"
                value={editingAgent.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="my-agent"
                style={inputStyle}
                disabled={!isNew}
              />
            </div>
            <div style={fieldGroupStyle}>
              <label style={fieldLabelStyle}>标题</label>
              <input
                type="text"
                value={editingAgent.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="显示标题"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={fieldGroupStyle}>
            <label style={fieldLabelStyle}>描述</label>
            <input
              type="text"
              value={editingAgent.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Agent 的简短描述..."
              style={inputStyle}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '14px',
            }}
          >
            <div style={fieldGroupStyle}>
              <label style={fieldLabelStyle}>模型</label>
              <input
                type="text"
                value={editingAgent.model ?? ''}
                onChange={(e) => updateField('model', e.target.value)}
                placeholder="例如 gpt-4o"
                style={inputStyle}
              />
            </div>
            <div style={fieldGroupStyle}>
              <label style={fieldLabelStyle}>权限级别</label>
              <select
                value={editingAgent.permissions ?? 'default'}
                onChange={(e) => updateField('permissions', e.target.value)}
                style={selectStyle}
              >
                {PERMISSION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={fieldGroupStyle}>
            <label style={fieldLabelStyle}>系统提示词</label>
            <textarea
              value={editingAgent.systemPrompt ?? ''}
              onChange={(e) => updateField('systemPrompt', e.target.value)}
              placeholder="Agent 的系统提示词..."
              style={textareaStyle}
            />
          </div>

          <div style={fieldGroupStyle}>
            <label style={fieldLabelStyle}>颜色标识</label>
            <div style={colorPickerRowStyle}>
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  style={{
                    ...colorSwatchStyle(editingAgent.color === color),
                    background: color,
                  }}
                  onClick={() => updateField('color', color)}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </div>
          </div>

          <div style={buttonRowStyle}>
            <button
              type="button"
              style={{
                ...saveButtonStyle,
                opacity: editingAgent.name.trim() ? 1 : 0.5,
                cursor: editingAgent.name.trim() ? 'pointer' : 'not-allowed',
              }}
              onClick={handleSave}
              disabled={!editingAgent.name.trim()}
            >
              保存
            </button>
            <button
              type="button"
              style={cancelButtonStyle}
              onClick={cancelEdit}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = '#d1d5db';
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#6b7280';
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = '#6b7280';
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#333333';
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Agent list */}
      {agents.length === 0 && !editingAgent ? (
        <div style={agentListCardStyle}>
          <div style={emptyStateStyle}>
            <p style={{ marginBottom: '6px' }}>暂无自定义 Agent</p>
            <p style={{ fontSize: '12px' }}>点击上方按钮创建一个新 Agent</p>
          </div>
        </div>
      ) : (
        agents.length > 0 && (
          <div style={agentListCardStyle}>
            {agents.map((agent, idx) => (
              <div
                key={agent.name}
                style={{
                  ...agentRowStyle,
                  borderBottom:
                    idx === agents.length - 1 ? 'none' : '1px solid #2a2a2a',
                }}
              >
                <span style={colorDotStyle(agent.color || '#6b7280')} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={agentNameStyle}>{agent.name}</div>
                  {agent.title && (
                    <div style={agentTitleStyle}>
                      {agent.title}
                      {agent.model && ` · ${agent.model}`}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  style={actionButtonStyle}
                  onClick={() => startEdit(agent)}
                  onMouseOver={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.color = '#22d3ee')
                  }
                  onMouseOut={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.color = '#6b7280')
                  }
                >
                  编辑
                </button>
                <button
                  type="button"
                  style={actionButtonStyle}
                  onClick={() => handleDelete(agent.name)}
                  onMouseOver={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.color = '#f87171')
                  }
                  onMouseOut={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.color = '#6b7280')
                  }
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default AgentEditorPanel;
