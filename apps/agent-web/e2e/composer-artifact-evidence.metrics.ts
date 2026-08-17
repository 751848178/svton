import type { Page } from '@playwright/test';

export async function collectComposerArtifactMetrics(page: Page) {
  return page.evaluate(() => {
    const rect = (node: Element | null) => {
      const box = node?.getBoundingClientRect();
      return box ? {
        x: box.x, y: box.y, width: box.width, height: box.height,
        right: box.right, bottom: box.bottom,
      } : null;
    };
    const overflow = (node: HTMLElement | null) => node ? ({
      clientWidth: node.clientWidth, scrollWidth: node.scrollWidth,
      clientHeight: node.clientHeight, scrollHeight: node.scrollHeight,
      overflowX: getComputedStyle(node).overflowX,
      overflowY: getComputedStyle(node).overflowY,
    }) : null;
    const pane = (selector: string) => {
      const node = document.querySelector<HTMLElement>(selector);
      const box = node?.getBoundingClientRect();
      const style = node ? getComputedStyle(node) : null;
      return {
        present: Boolean(node), rect: rect(node),
        visible: Boolean(box && box.width > 0 && box.height > 0
          && style?.display !== 'none' && style?.visibility !== 'hidden'),
        ariaHidden: node?.getAttribute('aria-hidden') === 'true',
        inert: Boolean(node?.inert || node?.hasAttribute('inert')),
      };
    };
    const host = document.querySelector<HTMLElement>('[data-responsive-artifact-host]');
    const chatPane = document.querySelector<HTMLElement>('[data-artifact-chat-pane]');
    const artifactPane = document.querySelector<HTMLElement>('[data-artifact-content-pane]');
    const active = document.activeElement as HTMLElement | null;
    const popup = document.querySelector<HTMLElement>('[role="listbox"]');
    const editor = document.querySelector<HTMLTextAreaElement>('[data-artifact-panel] [role="tabpanel"] textarea');
    const artifactScroller = editor
      ?? document.querySelector<HTMLElement>('[data-artifact-panel] [role="tabpanel"]');
    const chatScroller = document.querySelector<HTMLElement>('[role="log"][aria-label="Conversation transcript"]');
    const visibleDevSurfaces: Array<Record<string, unknown>> = [];
    const scanDevTree = (root: Document | ShadowRoot | Element) => {
      for (const node of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
        if (node.shadowRoot) scanDevTree(node.shadowRoot);
        if (!node.matches('button, [role="dialog"], [role="alertdialog"]')) continue;
        const box = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        if (box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden') {
          visibleDevSurfaces.push({
            tag: node.tagName, role: node.getAttribute('role'),
            label: node.getAttribute('aria-label'),
            text: (node.textContent || '').trim().slice(0, 120),
            width: box.width, height: box.height,
          });
        }
      }
    };
    const nextDevPortals = Array.from(document.querySelectorAll('nextjs-portal'));
    nextDevPortals.forEach((portal) => {
      if (portal.shadowRoot) scanDevTree(portal.shadowRoot);
    });
    const centerInsideClip = (node: HTMLElement, x: number, y: number) => {
      if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) return false;
      let owner = node.parentElement;
      while (owner) {
        const style = getComputedStyle(owner);
        if (['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX)
          || ['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowY)) {
          const box = owner.getBoundingClientRect();
          if (x < box.x || x > box.right || y < box.y || y > box.bottom) return false;
        }
        owner = owner.parentElement;
      }
      return true;
    };
    const primaryTargetNodes = Array.from(document.querySelectorAll<HTMLElement>([
      '[data-composer-actions] button',
      '[data-composer-actions] select',
      '[data-artifact-panel] header button',
      '[role="listbox"] [role="option"]',
      '[role="alertdialog"] button',
    ].join(',')));
    const visuallyActionable = (node: HTMLElement) => {
      const style = getComputedStyle(node);
      return style.visibility !== 'hidden' && style.display !== 'none'
        && !node.closest('[aria-hidden="true"], [inert]');
    };
    const eligibleTarget = (node: HTMLElement) => {
      const box = node.getBoundingClientRect();
      return visuallyActionable(node) && box.width > 0 && box.height > 0
        && centerInsideClip(node, box.x + box.width / 2, box.y + box.height / 2);
    };
    const clippedPrimaryTargets = primaryTargetNodes.filter((node) => {
      const box = node.getBoundingClientRect();
      return visuallyActionable(node) && box.width > 0 && box.height > 0 && !eligibleTarget(node);
    }).map((node) => ({
      name: node.getAttribute('aria-label') || node.textContent?.trim() || node.tagName,
      rect: rect(node), reason: 'center-outside-viewport-or-clipping-ancestor',
    }));
    const hiddenPrimaryTargets = primaryTargetNodes.filter((node) => !visuallyActionable(node))
      .map((node) => ({
        name: node.getAttribute('aria-label') || node.textContent?.trim() || node.tagName,
        reason: 'hidden-or-inert-owner',
      }));
    const primaryTargets = primaryTargetNodes.filter(eligibleTarget).map((node) => {
      const box = node.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return {
        name: node.getAttribute('aria-label') || node.textContent?.trim() || node.tagName,
        width: box.width, height: box.height,
        hitTestPassed: hit === node || Boolean(hit && node.contains(hit)),
        hitTag: hit?.tagName,
        hitLabel: hit?.getAttribute('aria-label'),
      };
    });
    const composerOverflowDescendants = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="composer-surface"] *'),
    ).filter((node) => node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1)
      .map((node) => ({
        tag: node.tagName, testId: node.getAttribute('data-testid'),
        label: node.getAttribute('aria-label'), className: node.className,
        clientWidth: node.clientWidth, scrollWidth: node.scrollWidth,
      }));
    const criticalRects = {
      frame: rect(document.querySelector('[data-testid="responsive-agent-frame"]')),
      frameContent: rect(document.querySelector('[data-responsive-frame-content]')),
      artifactHost: rect(host), chatPane: rect(chatPane), artifactPane: rect(artifactPane),
      composer: rect(document.querySelector('[data-testid="composer-surface"]')),
      chatInput: rect(document.querySelector('[data-testid="chat-input"]')),
      composerActions: rect(document.querySelector('[data-composer-actions]')),
      composerControls: rect(document.querySelector('[data-composer-control-group]')),
      composerSubmit: rect(document.querySelector('[data-composer-submit-group]')),
      attachments: rect(document.querySelector('[aria-label="草稿附件"]')),
      popup: rect(popup), artifactPanel: rect(document.querySelector('[data-artifact-panel]')),
      artifactHeading: rect(document.querySelector('[data-artifact-heading]')),
      artifactTabs: rect(document.querySelector('[role="tablist"][aria-label="内容视图"]')),
      dirtyDialog: rect(document.querySelector('[role="alertdialog"]')),
    };
    const overflowOwners = {
      documentElement: overflow(document.documentElement),
      frame: overflow(document.querySelector('[data-testid="responsive-agent-frame"]')),
      frameContent: overflow(document.querySelector('[data-responsive-frame-content]')),
      artifactHost: overflow(host), chatPane: overflow(chatPane), artifactPane: overflow(artifactPane),
      composer: overflow(document.querySelector('[data-testid="composer-surface"]')),
      composerControls: overflow(document.querySelector('[data-composer-control-group]')),
      popup: overflow(popup), transcript: overflow(chatScroller), artifactScroller: overflow(artifactScroller),
    };
    const closeControls = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-artifact-panel] button'))
      .map((button) => button.getAttribute('aria-label'))
      .filter((label): label is string => label === '返回对话并关闭内容面板' || label === '关闭内容面板');
    return {
      viewport: { width: innerWidth, height: innerHeight },
      devicePixelRatio, visualViewport: visualViewport ? {
        width: visualViewport.width, height: visualViewport.height,
        scale: visualViewport.scale, offsetLeft: visualViewport.offsetLeft,
        offsetTop: visualViewport.offsetTop,
      } : null,
      locale: { document: document.documentElement.lang, browser: navigator.language },
      environment: { userAgent: navigator.userAgent, platform: navigator.platform },
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      messageCount: document.querySelectorAll('[data-testid="message-user"], [data-testid="message-assistant"]').length,
      frameBand: document.querySelector('[data-responsive-band]')?.getAttribute('data-responsive-band'),
      artifact: {
        layout: host?.getAttribute('data-artifact-layout'),
        band: host?.getAttribute('data-artifact-band'),
        measuredWidth: Number(host?.getAttribute('data-measured-width') || 0),
        panelCount: document.querySelectorAll('[data-artifact-panel]').length,
        chatPane: pane('[data-artifact-chat-pane]'),
        contentPane: pane('[data-artifact-content-pane]'),
        closeControls,
      },
      state: {
        composerValue: document.querySelector<HTMLTextAreaElement>('[data-testid="chat-input"]')?.value ?? '',
        attachmentCount: document.querySelector('[aria-label="草稿附件"]')?.children.length ?? 0,
        selectedTab: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim(),
        editorValue: editor?.value,
        chatScrollTop: chatScroller?.scrollTop ?? 0,
        chatScrollFromBottom: chatScroller
          ? Math.max(0, chatScroller.scrollHeight - chatScroller.clientHeight - chatScroller.scrollTop)
          : 0,
        chatAtBottom: chatScroller
          ? chatScroller.scrollHeight - chatScroller.clientHeight - chatScroller.scrollTop <= 1
          : true,
        artifactScrollTop: artifactScroller?.scrollTop ?? 0,
        focusPane: chatPane?.contains(active) ? 'chat' : artifactPane?.contains(active) ? 'artifact' : 'outside',
        activeElement: active ? {
          tag: active.tagName, testId: active.getAttribute('data-testid'),
          label: active.getAttribute('aria-label'), text: active.textContent?.trim().slice(0, 80),
        } : null,
        popupVisible: Boolean(popup && popup.getBoundingClientRect().width > 0),
        popupPlacement: popup?.getAttribute('data-popup-placement'),
      },
      nextDevPortalCount: nextDevPortals.length,
      nextDevVisibleSurfaces: visibleDevSurfaces,
      primaryTargets, clippedPrimaryTargets, hiddenPrimaryTargets,
      composerOverflowDescendants, criticalRects, overflowOwners,
    };
  });
}
