import React, { useState } from 'react';

// ════════════════════════════════════════════════════════════
// SandboxSettings — sandbox configuration panel
// ════════════════════════════════════════════════════════════

export interface SandboxSettingsProps {
  enabled: boolean;
  mode: 'read_only' | 'workspace_write' | 'full_access';
  onChange: (config: { enabled: boolean; mode: string }) => void;
}

const MODE_OPTIONS: Array<{
  id: 'read_only' | 'workspace_write' | 'full_access';
  label: string;
  description: string;
  badgeColor: string;
}> = [
  {
    id: 'read_only',
    label: '只读模式',
    description: 'Only read files, no modifications',
    badgeColor: '#4b5563',
  },
  {
    id: 'workspace_write',
    label: '工作区写入',
    description: 'Read and write within the workspace directory',
    badgeColor: '#0891b2',
  },
  {
    id: 'full_access',
    label: '完全访问',
    description: 'Unrestricted access (not recommended)',
    badgeColor: '#dc2626',
  },
];

export function SandboxSettings({ enabled, mode, onChange }: SandboxSettingsProps) {
  const [localEnabled, setLocalEnabled] = useState(enabled);
  const [localMode, setLocalMode] = useState<'read_only' | 'workspace_write' | 'full_access'>(mode);

  const handleToggle = (value: boolean) => {
    setLocalEnabled(value);
    onChange({ enabled: value, mode: localMode });
  };

  const handleModeChange = (value: 'read_only' | 'workspace_write' | 'full_access') => {
    setLocalMode(value);
    onChange({ enabled: localEnabled, mode: value });
  };

  const cardStyle: React.CSSProperties = {
    background: '#1c1c1c',
    borderRadius: '12px',
    border: '1px solid #2a2a2a',
    padding: '20px',
    marginBottom: '16px',
  };

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

  const toggleContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: '#171717',
    borderRadius: '10px',
    border: '1px solid #2a2a2a',
    marginBottom: '16px',
  };

  const toggleLabelStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#e5e7eb',
    fontWeight: 500,
  };

  const toggleSwitchStyle = (isOn: boolean): React.CSSProperties => ({
    position: 'relative',
    display: 'inline-flex',
    height: '18px',
    width: '32px',
    alignItems: 'center',
    borderRadius: '9999px',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    transition: 'background-color 200ms ease',
    backgroundColor: isOn ? '#0891b2' : '#333333',
  });

  const toggleKnobStyle = (isOn: boolean): React.CSSProperties => ({
    display: 'inline-block',
    height: '12px',
    width: '12px',
    borderRadius: '9999px',
    backgroundColor: '#ffffff',
    transition: 'transform 200ms ease',
    transform: isOn ? 'translateX(17px)' : 'translateX(3px)',
  });

  const modeButtonStyle = (isActive: boolean): React.CSSProperties => ({
    width: '100%',
    textAlign: 'left',
    padding: '14px 16px',
    borderRadius: '10px',
    border: isActive ? '1px solid #0e7490' : '1px solid #2a2a2a',
    background: isActive ? 'rgba(8,145,178,0.15)' : '#1c1c1c',
    cursor: 'pointer',
    marginBottom: '8px',
    transition: 'border-color 150ms ease, background 150ms ease',
    opacity: localEnabled ? 1 : 0.4,
  });

  const modeLabelRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  };

  const radioOuterStyle = (isActive: boolean): React.CSSProperties => ({
    width: '12px',
    height: '12px',
    borderRadius: '9999px',
    border: `2px solid ${isActive ? '#06b6d4' : '#444444'}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  });

  const radioInnerStyle = (isActive: boolean): React.CSSProperties => ({
    width: '6px',
    height: '6px',
    borderRadius: '9999px',
    backgroundColor: isActive ? '#06b6d4' : 'transparent',
  });

  const modeTitleStyle = (isActive: boolean): React.CSSProperties => ({
    fontSize: '14px',
    fontWeight: 500,
    color: isActive ? '#67e8f9' : '#d1d5db',
  });

  const modeDescStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#6b7280',
    marginLeft: '20px',
  };

  const infoBannerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '12px 14px',
    borderRadius: '10px',
    background: 'rgba(8,145,178,0.08)',
    border: '1px solid rgba(14,116,144,0.4)',
  };

  const infoTextStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#94a3b8',
    lineHeight: 1.5,
  };

  const infoIconStyle: React.CSSProperties = {
    flexShrink: 0,
    marginTop: '1px',
  };

  return (
    <div>
      <h2 style={sectionTitleStyle}>沙箱</h2>
      <p style={sectionDescStyle}>配置沙箱隔离，限制 Agent 对文件系统的访问范围。</p>

      <div style={cardStyle}>
        {/* Enable/disable toggle */}
        <div style={toggleContainerStyle}>
          <div>
            <span style={toggleLabelStyle}>启用沙箱</span>
            <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
              沙箱为 Agent 的文件操作提供隔离保护
            </p>
          </div>
          <button
            type="button"
            style={toggleSwitchStyle(localEnabled)}
            onClick={() => handleToggle(!localEnabled)}
            aria-label="Toggle sandbox"
          >
            <span style={toggleKnobStyle(localEnabled)} />
          </button>
        </div>

        {/* Mode selection */}
        <div style={{ marginBottom: '4px' }}>
          <label
            style={{
              fontSize: '11px',
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'block',
              marginBottom: '8px',
            }}
          >
            访问模式
          </label>
        </div>

        {MODE_OPTIONS.map((opt) => {
          const isActive = localMode === opt.id && localEnabled;
          return (
            <button
              key={opt.id}
              type="button"
              style={modeButtonStyle(isActive)}
              onClick={() => handleModeChange(opt.id)}
              disabled={!localEnabled}
            >
              <div style={modeLabelRowStyle}>
                <span style={radioOuterStyle(isActive)}>
                  <span style={radioInnerStyle(isActive)} />
                </span>
                <span style={modeTitleStyle(isActive)}>{opt.label}</span>
              </div>
              <p style={modeDescStyle}>{opt.description}</p>
            </button>
          );
        })}

        {/* Info banner */}
        <div style={infoBannerStyle}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#06b6d4"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={infoIconStyle}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span style={infoTextStyle}>
            沙箱通过隔离文件系统访问来保护您的系统。启用后，Agent 的所有文件操作将在沙箱限制范围内执行。
            推荐使用「工作区写入」模式以获得安全与功能之间的平衡。
          </span>
        </div>
      </div>
    </div>
  );
}

export default SandboxSettings;
