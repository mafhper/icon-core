import React from 'react';
import ReactDOM from 'react-dom/client';
import { ComposerApp } from './composer/ComposerApp';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ComposerApp />
  </React.StrictMode>
);
