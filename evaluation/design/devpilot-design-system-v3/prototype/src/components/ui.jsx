import { CheckCircle, CircleNotch, WarningCircle, XCircle } from '@phosphor-icons/react';

export function Button({ children, variant = 'primary', size = 'md', ...props }) {
  return <button className={`button ${variant} ${size}`} {...props}>{children}</button>;
}

export function Status({ value, children }) {
  const icons = {
    success: <CheckCircle weight="fill" />,
    blocked: <XCircle weight="fill" />,
    running: <CircleNotch weight="bold" className="spin" />,
    warning: <WarningCircle weight="fill" />,
  };
  return <span className={`status ${value}`}>{icons[value]}{children}</span>;
}

export function ScreenTitle({ as: Heading = 'h2', title, description, actions }) {
  return (
    <div className="screen-title">
      <div><Heading>{title}</Heading><p>{description}</p></div>
      {actions && <div className="screen-actions">{actions}</div>}
    </div>
  );
}

export function SectionHeading({ title, meta, actions }) {
  return (
    <div className="section-heading">
      <div><h3>{title}</h3>{meta && <p>{meta}</p>}</div>
      {actions && <div>{actions}</div>}
    </div>
  );
}

export function KeyValue({ label, children, mono = false }) {
  return <div className="key-value"><span>{label}</span><strong className={mono ? 'mono' : ''}>{children}</strong></div>;
}

export function ProgressLine({ value = 0 }) {
  return <div className="progress-track" aria-label={`进度 ${value}%`}><span style={{ width: `${value}%` }} /></div>;
}
