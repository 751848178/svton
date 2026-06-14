import React, { useState } from 'react';

// ════════════════════════════════════════════════════════════
// AutoReviewerSettings — auto-reviewer configuration panel
// ════════════════════════════════════════════════════════════

export interface AutoReviewerRule {
  id: string;
  description: string;
  verdict: string;
}

export interface AutoReviewerSettingsProps {
  mode: 'auto_review' | 'manual';
  rules: AutoReviewerRule[];
  onModeChange: (mode: 'auto_review' | 'manual') => void;
}

type VerdictColor = 'green' | 'red' | 'yellow';

function getVerdictColor(verdict: string): VerdictColor {
  const v = verdict.toLowerCase();
  if (v.includes('approve') || v.includes('allow') || v.includes('pass')) return 'green';
  if (v.includes('deny') || v.includes('block') || v.includes('reject')) return 'red';
  return 'yellow';
}

function getVerdictBg(color: VerdictColor): string {
  switch (color) {
    case 'green':
      return 'rgba(34,197,94,0.15)';
    case 'red':
      return 'rgba(239,68,68,0.15)';
    case 'yellow':
      return 'rgba(234,179,8,0.15)';
  }
}

function getVerdictTextColor(color: VerdictColor): string {
  switch (color) {
    case 'green':
      return '#4ade80';
    case 'red':
      return '#f87171';
    case 'yellow':
      return '#facc15';
  }
}

export function AutoReviewerSettings({ mode, rules, onModeChange }: AutoReviewerSettingsProps) {
  const [localMode, setLocalMode] = useState<'auto_review' | 'manual'>(mode);

  const handleToggle = () => {
    const newMode = localMode === 'auto_review' ? 'manual' : 'auto_review';
    setLocalMode(newMode);
    onModeChange(newMode);
  };

  const isAuto = localMode === 'auto_review';

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

  const cardStyle: React.CSSProperties = {
    background: '#1c1c1c',
    borderRadius: '12px',
    border: '1px solid #2a2a2a',
    padding: '20px',
    marginBottom: '16px',
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

  const descTextStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#6b7280',
    lineHeight: 1.6,
    padding: '12px 14px',
    borderRadius: '10px',
    background: 'rgba(8,145,178,0.06)',
    border: '1px solid rgba(14,116,144,0.25)',
    marginBottom: '16px',
  };

  const ruleItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px 14px',
    background: '#171717',
    borderRadius: '8px',
    border: '1px solid #2a2a2a',
    marginBottom: '6px',
  };

  const ruleDescStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#d1d5db',
    flex: 1,
  };

  const ruleIdStyle: React.CSSProperties = {
    fontSize: '10px',
    color: '#6b7280',
    fontFamily: 'monospace',
    marginTop: '2px',
  };

  const verdictBadgeStyle = (color: VerdictColor): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: getVerdictTextColor(color),
    backgroundColor: getVerdictBg(color),
    flexShrink: 0,
    whiteSpace: 'nowrap',
  });

  const rulesHeaderStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '10px',
    fontWeight: 500,
  };

  return (
    <div>
      <h2 style={sectionTitleStyle}>自动审核</h2>
      <p style={sectionDescStyle}>配置工具调用的自动审核行为。</p>

      <div style={cardStyle}>
        {/* Mode toggle */}
        <div style={toggleContainerStyle}>
          <div>
            <span style={{ fontSize: '14px', color: '#e5e7eb', fontWeight: 500 }}>
              自动审核模式
            </span>
            <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
              {isAuto ? '当前：自动审核（安全规则自动通过）' : '当前：手动模式（所有调用需确认）'}
            </p>
          </div>
          <button
            type="button"
            style={toggleSwitchStyle(isAuto)}
            onClick={handleToggle}
            aria-label="Toggle auto-review mode"
          >
            <span style={toggleKnobStyle(isAuto)} />
          </button>
        </div>

        {/* Description banner */}
        <div style={descTextStyle}>
          {isAuto
            ? '在自动模式下，符合安全规则的工具调用会自动通过审批。'
            : '在手动模式下，所有工具调用都需要人工审批。'}
          <br />
          In auto mode, tool calls matching safe rules are auto-approved. In manual mode, all tool calls require approval.
        </div>

        {/* Built-in rules list */}
        <div style={rulesHeaderStyle}>内置规则</div>
        {rules.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '24px',
              color: '#6b7280',
              fontSize: '13px',
            }}
          >
            暂无已配置的规则
          </div>
        ) : (
          rules.map((rule) => {
            const color = getVerdictColor(rule.verdict);
            return (
              <div key={rule.id} style={ruleItemStyle}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={ruleDescStyle}>{rule.description}</div>
                  <div style={ruleIdStyle}>{rule.id}</div>
                </div>
                <span style={verdictBadgeStyle(color)}>{rule.verdict}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default AutoReviewerSettings;
