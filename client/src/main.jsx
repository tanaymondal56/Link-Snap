import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary';
import CanonicalUpdater from './components/CanonicalUpdater';

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
