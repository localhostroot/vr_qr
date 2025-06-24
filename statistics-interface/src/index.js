import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import {ResponsiveProvider} from "./utils/responsiveContext";

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <ResponsiveProvider>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </ResponsiveProvider>
);

