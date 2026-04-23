/**
 * ================================================
 * TESTMO DASHBOARD - Entry Point
 * ================================================
 * Point d'entrée principal de l'application React
 * 
 * @author Matou - Neo-Logix QA Lead
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import './styles/Toast.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>
);
