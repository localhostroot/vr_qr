import './App.css';
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { AuthPage } from "./pages/AuthPage/AuthPage";
import { AdminPage } from "./pages/AdminPage/AdminPage";
import { HeadAdminLocationPage } from "./pages/HeadAdminLocationPage/HeadAdminLocationPage";
import { HeadAdminPage } from "./pages/HeadAdminPage/HeadAdminPage";
import PrivateRoute from "./utils/PrivateRoot";

function App() {
  const navigate = useNavigate();

  const handleLogin = (is_superuser, location, token) => {
    localStorage.setItem('is_superuser', JSON.stringify(is_superuser));
    localStorage.setItem('token', token);

    if (is_superuser) {
      navigate('/head-admin');
    } else {
      navigate('/admin');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('is_superuser');
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('is_staff');

    navigate('/');
  };

  return (
      <div className="App">
        <div className="appWrapper">
          <Routes>
            <Route path="/" element={<AuthPage onLogin={handleLogin} />} />

            <Route path="/head-admin" element={
              <PrivateRoute requiredSuperuser={true}>
                <HeadAdminPage onLogout={handleLogout} />
              </PrivateRoute>
            } />

            <Route path="/head-admin/:location" element={
              <PrivateRoute requiredSuperuser={true}>
                <HeadAdminLocationPage onLogout={handleLogout} />
              </PrivateRoute>
            } />

            <Route path="/admin" element={
              <PrivateRoute>
                <AdminPage onLogout={handleLogout} />
              </PrivateRoute>
            } />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
  );
}
export default App;