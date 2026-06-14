import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Force dark mode for the desktop app (Codex-style)
document.documentElement.classList.add('dark');

// Block showcase route: append ?blocks to URL
if (new URLSearchParams(window.location.search).has('blocks')) {
  import('./BlockShowcase').then(({ BlockShowcase }) => {
    ReactDOM.createRoot(document.getElementById('root')!).render(<BlockShowcase />);
  });
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
}
