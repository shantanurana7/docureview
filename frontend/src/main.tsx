import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';
import App from './App';
import './index.css';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
        <HashRouter>
            <StoreProvider>
                <App />
            </StoreProvider>
        </HashRouter>
    </React.StrictMode>
);
