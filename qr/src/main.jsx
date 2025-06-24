import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.jsx'
import {ErrorBoundary} from "./app/providers/ErrorBoundary/index.js";
import {BrowserRouter} from "react-router-dom";
import {Suspense} from "react";
import store from "./shared/store.js";
import { Provider } from 'react-redux';
import Loader from "./widgets/Loader/Loader.jsx";

createRoot(document.getElementById('root')).render(
    <Provider store={store}>
        <BrowserRouter>
            <ErrorBoundary>
                    <Suspense fallback={<Loader/>}>
                        <App />
                    </Suspense>
            </ErrorBoundary>
        </BrowserRouter>
    </Provider>
)
