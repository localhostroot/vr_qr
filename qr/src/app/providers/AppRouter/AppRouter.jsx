import React from 'react';
import { Route, Routes } from 'react-router-dom';
import {routeConfig} from "@/shared/config/routeConfig/routeConfig.jsx";
import {NotFoundPage} from "@/pages/NotFoundPage/index.js";

const AppRouter = () => {
    return (
        <Routes>
            {routeConfig.map((route, index) => (
                <Route
                    key={index}
                    path={route.path}
                    element={route.element}
                    exact={route.exact}
                />
            ))}
            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    );
};

export default AppRouter;