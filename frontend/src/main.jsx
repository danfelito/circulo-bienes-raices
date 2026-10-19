import { captureAttribution } from './marketingAttribution';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

captureAttribution();
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
