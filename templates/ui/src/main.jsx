import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { fetchConfig } from './lib/api';
import { setLang } from './lib/i18n';
import './styles/global.css';

async function init() {
  try {
    const config = await fetchConfig();
    if (config.lang) setLang(config.lang);
  } catch {
    // Default to English
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
}

init();
