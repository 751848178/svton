import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Force dark mode for the desktop app (Codex-style)
document.documentElement.classList.add('dark');

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
