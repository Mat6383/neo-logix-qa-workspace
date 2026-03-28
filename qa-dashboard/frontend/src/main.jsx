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

// Montage de l'application
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
