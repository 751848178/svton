import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Avatar } from '../src/components/Avatar';
import { CollapseItem } from '../src/components/Collapse';
import { Copyable } from '../src/components/Copyable';
import { ErrorState } from '../src/components/ErrorState';
import { Notification, NotificationContainer, notification } from '../src/components/Notification';
import { PermissionState } from '../src/components/PermissionState';
import { ProgressState } from '../src/components/ProgressState';
import { Tag } from '../src/components/Tag';

function expectInstalledIcons(container: HTMLElement) {
  const icons = [...container.querySelectorAll('svg')];
  expect(icons.length).toBeGreaterThan(0);
  for (const icon of icons) expect(icon).toHaveClass('lucide');
}

describe('I08.3c-1 rendered asset contract', () => {
  it('preserves real Avatar images and exposes a labelled library fallback', () => {
    const view = render(<Avatar src="/avatar.png" alt="Ada profile" />);
    const image = screen.getByRole('img', { name: 'Ada profile' });
    expect(image).toHaveAttribute('src', '/avatar.png');

    fireEvent.error(image);
    expect(screen.getByRole('img', { name: 'Ada profile' })).toBe(view.container.firstElementChild);
    expect(view.container.querySelector('img')).not.toBeInTheDocument();
    expect(view.container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expectInstalledIcons(view.container);
  });

  it('keeps Collapse disclosure state and keyboard activation with a shared chevron', () => {
    const view = render(<CollapseItem title="Details">Body</CollapseItem>);
    const trigger = screen.getByRole('button', { name: 'Details' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(trigger, { key: ' ' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(view.container.querySelector('svg')).toHaveClass('lucide-chevron-right');
    expectInstalledIcons(view.container);
  });

  it('keeps Copyable callback and visible copied state with library icons', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const onCopy = vi.fn();
    const view = render(<Copyable text="value" onCopy={onCopy} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await screen.findByRole('button', { name: 'Copied' });
    expect(writeText).toHaveBeenCalledWith('value');
    expect(onCopy).toHaveBeenCalledWith('value');
    expect(view.container.querySelector('svg')).toHaveClass('lucide-check');
    expectInstalledIcons(view.container);
  });

  it('renders status meaning through distinct library shapes and visible text', () => {
    const view = render(
      <>
        <ErrorState title="Failed" message="Try again" />
        <PermissionState title="Access denied" message="Ask an owner" />
        <ProgressState percent={100} status="success" text="Complete" />
        <ProgressState percent={42} status="error" text="Stopped" />
      </>,
    );
    expect(screen.getByText('Failed')).toBeVisible();
    expect(screen.getByText('Access denied')).toBeVisible();
    expect(screen.getByRole('img', { name: 'Success' })).toHaveClass('lucide-circle-check');
    expect(screen.getByRole('img', { name: 'Failed' })).toHaveClass('lucide-circle-x');
    expect(screen.getByText('Complete')).toBeVisible();
    expect(screen.getByText('Stopped')).toBeVisible();
    expectInstalledIcons(view.container);
  });

  it.each([
    ['info', 'lucide-info'],
    ['success', 'lucide-circle-check'],
    ['warning', 'lucide-triangle-alert'],
    ['error', 'lucide-circle-x'],
  ] as const)(
    'renders the %s notification with an installed status icon',
    (type, iconClass) => {
      const view = render(<Notification title={`${type} notice`} type={type} duration={0} closable={false} />);
      const icon = view.container.querySelector(`[data-status-icon="${type}"]`);
      expect(icon).toHaveClass('lucide', iconClass);
      expect(screen.getByText(`${type} notice`)).toBeVisible();
    },
  );

  it('uses named native close controls with keyboard-style activation and callbacks', async () => {
    const onNotificationClose = vi.fn();
    const onTagClose = vi.fn();
    render(
      <>
        <Notification title="Notice" duration={0} onClose={onNotificationClose} />
        <Tag closable onClose={onTagClose}>Filter</Tag>
      </>,
    );
    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    expect(closeButtons).toHaveLength(2);
    for (const button of closeButtons) {
      expect(button.tagName).toBe('BUTTON');
      expect(button).toHaveAttribute('type', 'button');
      expect(button.querySelector('svg')).toHaveClass('lucide-x');
    }
    expect(closeButtons[1]).toHaveClass('size-6');
    closeButtons[1].focus();
    fireEvent.click(closeButtons[1], { detail: 0 });
    expect(onTagClose).toHaveBeenCalledOnce();
    closeButtons[0].focus();
    fireEvent.click(closeButtons[0], { detail: 0 });
    await waitFor(() => expect(onNotificationClose).toHaveBeenCalledOnce());
  });

  it('keeps exactly one live status owner for standalone and container notifications', () => {
    const standalone = render(<Notification title="Standalone" duration={0} />);
    expect(standalone.container.querySelectorAll('[role="status"]')).toHaveLength(1);
    standalone.unmount();

    render(<NotificationContainer />);
    act(() => notification.info({ title: 'Contained', duration: 0 }));
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByText('Contained').closest('[role="status"]')).toBe(screen.getByRole('status'));
  });
});
