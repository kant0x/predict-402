import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Providers } from './Providers';
import { DepositProvider } from './context/DepositContext';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Providers>
      <DepositProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </DepositProvider>
    </Providers>
  </React.StrictMode>,
);
