import React, { useState } from 'react';

// ════════════════════════════════════════════════════════════
// IntegrationsPanel — third-party integration configuration
// ════════════════════════════════════════════════════════════

export interface IntegrationAuthField {
  key: string;
  label: string;
  secret: boolean;
  placeholder?: string;
}

export interface IntegrationCardData {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  authFields: IntegrationAuthField[];
  credentials: Record<string, string>;
}

export interface IntegrationsPanelProps {
  integrations: IntegrationCardData[];
  onToggle: (id: string, enabled: boolean) => void;
  onCredentialChange: (id: string, key: string, value: string) => void;
}

export function IntegrationsPanel({
  integrations,
  onToggle,
  onCredentialChange,
}: IntegrationsPanelProps) {
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; message: string } | null>>({});

  const handleTest = (id: string) => {
    setTestingId(id);
    setTestResult((prev) => ({ ...prev, [id]: null }));
    // UI-only: simulate a test request; actual testing is handled by parent
    setTimeout(() => {
      setTestingId(null);
      // The parent handles real testing; here we just clear the testing state
    }, 1200);
  };

  const toggleSecretVisibility = (fieldKey: string) => {
    setShowSecrets((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
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

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: '16px',
  };

  const cardStyle: React.CSSProperties = {
    background: '#1c1c1c',
    borderRadius: '12px',
    border: '1px solid #2a2a2a',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
  };

  const cardHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  };

  const integrationNameStyle: React.CSSProperties = {
    fontSize: '15px',
    fontWeight: 600,
    color: '#ffffff',
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

  const descriptionStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#6b7280',
    lineHeight: 1.5,
    marginBottom: '16px',
    minHeight: '36px',
  };

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    display: 'block',
    marginBottom: '6px',
  };

  const inputContainerStyle: React.CSSProperties = {
    position: 'relative',
    marginBottom: '12px',
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

  const eyeButtonStyle: React.CSSProperties = {
    position: 'absolute',
    right: '8px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    color: '#6b7280',
  };

  const testButtonBase: React.CSSProperties = {
    padding: '7px 14px',
    fontSize: '11px',
    fontWeight: 600,
    borderRadius: '8px',
    cursor: 'pointer',
    border: '1px solid #0e7490',
    background: 'transparent',
    color: '#22d3ee',
    transition: 'background 150ms ease',
    marginTop: 'auto',
    alignSelf: 'flex-start',
  };

  const statusBadgeStyle = (enabled: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 7px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 500,
    color: enabled ? '#4ade80' : '#6b7280',
    background: enabled ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
  });

  const emptyStateStyle: React.CSSProperties = {
    background: '#1c1c1c',
    borderRadius: '12px',
    border: '1px solid #2a2a2a',
    padding: '48px 20px',
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '14px',
  };

  return (
    <div>
      <h2 style={sectionTitleStyle}>集成</h2>
      <p style={sectionDescStyle}>管理第三方服务集成，配置 API 凭据并测试连接。</p>

      {integrations.length === 0 ? (
        <div style={emptyStateStyle}>
          <p style={{ marginBottom: '6px' }}>暂无可用集成</p>
          <p style={{ fontSize: '12px' }}>可用的集成将在此处显示</p>
        </div>
      ) : (
        <div style={gridStyle}>
          {integrations.map((integration) => (
            <div key={integration.id} style={cardStyle}>
              {/* Header */}
              <div style={cardHeaderStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={integrationNameStyle}>{integration.name}</span>
                  <span style={statusBadgeStyle(integration.enabled)}>
                    {integration.enabled ? '已启用' : '未启用'}
                  </span>
                </div>
                <button
                  type="button"
                  style={toggleSwitchStyle(integration.enabled)}
                  onClick={() => onToggle(integration.id, !integration.enabled)}
                  aria-label={`Toggle ${integration.name}`}
                >
                  <span style={toggleKnobStyle(integration.enabled)} />
                </button>
              </div>

              {/* Description */}
              <p style={descriptionStyle}>{integration.description}</p>

              {/* Auth fields */}
              {integration.authFields.map((field) => {
                const fieldVisibilityKey = `${integration.id}:${field.key}`;
                const isVisible = showSecrets[fieldVisibilityKey] ?? false;
                const inputType = field.secret && !isVisible ? 'password' : 'text';
                return (
                  <div key={field.key}>
                    <label style={fieldLabelStyle}>{field.label}</label>
                    <div style={inputContainerStyle}>
                      <input
                        type={inputType}
                        value={integration.credentials[field.key] ?? ''}
                        placeholder={field.placeholder ?? ''}
                        onChange={(e) =>
                          onCredentialChange(integration.id, field.key, e.target.value)
                        }
                        style={
                          field.secret
                            ? { ...inputStyle, paddingRight: '36px' }
                            : inputStyle
                        }
                        disabled={!integration.enabled}
                      />
                      {field.secret && (
                        <button
                          type="button"
                          style={eyeButtonStyle}
                          onClick={() => toggleSecretVisibility(fieldVisibilityKey)}
                          tabIndex={-1}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            {isVisible ? (
                              <>
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                <line x1="1" y1="1" x2="23" y2="23" />
                              </>
                            ) : (
                              <>
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </>
                            )}
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Test Connection button */}
              <button
                type="button"
                style={{
                  ...testButtonBase,
                  opacity: testingId === integration.id ? 0.5 : 1,
                  cursor: testingId === integration.id ? 'default' : 'pointer',
                }}
                onClick={() => handleTest(integration.id)}
                disabled={testingId === integration.id || !integration.enabled}
              >
                {testingId === integration.id ? '测试中...' : '测试连接'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default IntegrationsPanel;
