import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import './index.css';
import './App.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';
import { FarmProvider } from './context/FarmContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <FarmProvider>
          <App />
          <ToastContainer
            theme="dark"
            position="bottom-right"
            autoClose={3500}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            pauseOnHover
          />
        </FarmProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
