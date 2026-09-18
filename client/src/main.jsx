import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary';
import CanonicalUpdater from './components/CanonicalUpdater';
import { initPWA } from './pwa';

// Register Service Worker immediately on app launch for offline resilience
initPWA();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <CanonicalUpdater />
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
