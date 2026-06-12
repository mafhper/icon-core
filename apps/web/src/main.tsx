import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { ComposerApp } from './composer/ComposerApp';
import './index.css';

const isComposerRoute = () => window.location.hash.startsWith('#/composer');

const RootApp = () => {
  const [isComposer, setIsComposer] = useState(isComposerRoute);

  useEffect(() => {
    const handleHashChange = () => setIsComposer(isComposerRoute());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return isComposer ? <ComposerApp /> : <App />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
