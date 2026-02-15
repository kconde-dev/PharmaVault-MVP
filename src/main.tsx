import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { ConnectionProvider } from '@/context/ConnectionContext';
import { AuthProvider } from '@/hooks/useAuth';

// Self-Service Auth Cleanup
if (window.location.search.includes('clear=true')) {
  localStorage.clear();
  window.location.href = window.location.origin + window.location.pathname;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ConnectionProvider>
          <App />
        </ConnectionProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
