import React, { useState } from 'react';
import style from './authpage.module.css';
import { useNavigate } from 'react-router-dom';

export const AuthPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const API_BASE_URL = process.env.REACT_APP_STATS_DATABASE;
    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        try {
            const response = await fetch(`${API_BASE_URL}api/login/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Ошибка при входе:', errorData);
                setError(errorData.non_field_errors ? errorData.non_field_errors[0] : 'Неверные учетные данные.');
                return;
            }

            const data = await response.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.username);
            localStorage.setItem('is_staff', data.is_staff);
            localStorage.setItem('is_superuser', data.is_superuser);

            navigate('/stats');

        } catch (error) {
            console.error('Ошибка входа:', error);
            setError('Произошла ошибка при подключении к серверу.');
        }
    };

    return (
        <div className={style.authPage}>
            <form onSubmit={handleSubmit}>
                {error && <div className={style.error}>{error}</div>}
                <div className={style.formEl}>
                    <label htmlFor="username">Имя пользователя:</label>
                    <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>
                <div className={style.formEl}>
                    <label htmlFor="password">Пароль:</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <button type="submit">Войти</button>
            </form>
        </div>
    );
};