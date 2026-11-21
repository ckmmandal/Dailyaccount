import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import Root from './App';

registerSW({ immediate: true });

// Suppress Recharts defaultProps warnings globally
const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Support for defaultProps will be removed')) {
    if (args[1] === 'XAxis' || args[1] === 'YAxis' || args[1] === 'XAxisSettingsDispatcher' || args[1] === 'YAxisSettingsDispatcher') {
      return;
    }
  }
  originalError.call(console, ...args);
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
