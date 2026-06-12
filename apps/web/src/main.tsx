import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { ComposerApp } from './composer/ComposerApp';
import './index.css';

const isComposer = window.location.hash.startsWith('#/composer');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isComposer ? <ComposerApp /> : <App />}
  </React.StrictMode>
);
