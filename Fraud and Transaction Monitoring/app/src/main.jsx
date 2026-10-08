import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyBranding } from './config';
import './index.css';

applyBranding();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
