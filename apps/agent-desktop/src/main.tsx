import React from 'react';
import ReactDOM from 'react-dom/client';
import { LocaleProvider } from '@svton/ui';
import App from './App';
import { initializeDesktopLocale } from './lib/locale/desktop-locale-host';
import './index.css';

// Force dark mode for the desktop app (Codex-style)
document.documentElement.classList.add('dark');
const locale = initializeDesktopLocale(
  document.documentElement,
  navigator.languages,
  navigator.language,
);

function renderRoot(content: React.ReactNode) {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <LocaleProvider locale={locale}>{content}</LocaleProvider>,
  );
}

// Block showcase route: append ?blocks to URL
if (new URLSearchParams(window.location.search).has('blocks')) {
  import('./BlockShowcase').then(({ BlockShowcase }) => {
    renderRoot(<BlockShowcase />);
  });
} else {
  renderRoot(<App />);
}
