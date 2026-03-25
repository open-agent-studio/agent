import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

const urlParams = new URLSearchParams(window.location.search);
const tokenParam = urlParams.get('token');
if (tokenParam) {
  localStorage.setItem('agent_studio_token', tokenParam);
  window.history.replaceState({}, document.title, window.location.pathname);
}

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const token = localStorage.getItem('agent_studio_token');
  const [resource, config] = args;
  
  const url = typeof resource === 'string' ? resource : resource instanceof Request ? resource.url : '';
  
  if (token && (url.startsWith('/api') || url.includes('/api/'))) {
    const newConfig = { ...config } as RequestInit;
    newConfig.headers = new Headers(newConfig.headers || {});
    (newConfig.headers as Headers).set('Authorization', `Bearer ${token}`);
    return originalFetch(resource, newConfig);
  }
  
  return originalFetch(...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
