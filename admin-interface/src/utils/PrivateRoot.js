import React from "react";
import {Navigate} from "react-router-dom";


function PrivateRoute({ requiredSuperuser, children }) {
    const isAuthenticated = localStorage.getItem('token');
    const isSuperuser = localStorage.getItem('is_superuser') === 'true';

    if (!isAuthenticated) {
        return <Navigate to="/"/>;
    }

    if (requiredSuperuser && !isSuperuser) {
        return <Navigate to="/admin"/>;
    }

    return children;
}

export default PrivateRoute
