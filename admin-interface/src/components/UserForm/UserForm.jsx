import React, { useState } from 'react';
import style from './userform.module.css';
import {useResponsive} from "../../utils/ResponsiveContext";

export const UserForm = ({onUserCreated}) => {
    const databaseApi = process.env.REACT_APP_ADMIN_DATABASE
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [location, setLocation] = useState('');
    const [locationName, setLocationName] = useState('');
    const [error, setError] = useState('');
    const { isPhone, isTablet, isDesktop } = useResponsive()

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        if (!username || !password || !location || !locationName) {
            setError('Пожалуйста, заполните все обязательные поля.');
            return;
        }

        try {
            const token = localStorage.getItem('token');

            const response = await fetch(`${databaseApi}users/create/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`,
                },
                body: JSON.stringify({
                    username: username,
                    password: password,
                    email: email,
                    first_name: firstName,
                    last_name: lastName,
                    profile: {
                        location: location,
                        location_name: locationName,
                    },
                }),
            });

            if (response.ok) {
                console.log('Пользователь успешно создан!');
                const newUser = await response.json();
                onUserCreated(newUser);
                setUsername('');
                setPassword('');
                setEmail('');
                setFirstName('');
                setLastName('');
                setLocation('');
                setLocationName('');
            } else {
                const errorData = await response.json();
                setError(`Ошибка создания пользователя: ${JSON.stringify(errorData)}`);
                if (response.status === 401) {
                    console.error('Неверный токен. Требуется повторная авторизация.');
                }
            }
        } catch (e) {
            setError(`Произошла ошибка: ${e.message}`);
        }
    };

    return (
        <div
            className={`${isDesktop && style.userForm} ${isPhone && style.userFormPhone} ${isTablet && style.userForm}`}
        >
            {error && <div className={style.error}>{error}</div>}
            <form onSubmit={handleSubmit}>
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
                <div className={style.formEl}>
                    <label htmlFor="email">Email:</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
                <div className={style.formEl}>
                    <label htmlFor="firstName">Имя:</label>
                    <input
                        type="text"
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                    />
                </div>
                <div className={style.formEl}>
                    <label htmlFor="lastName">Фамилия:</label>
                    <input
                        type="text"
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                    />
                </div>
                <div className={style.formEl}>
                    <label htmlFor="location">Локация:</label>
                    <input
                        type="text"
                        id="location"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        required
                    />
                </div>
                <div className={style.formEl}>
                    <label htmlFor="locationName">Название локации:</label>
                    <input
                        type="text"
                        id="locationName"
                        value={locationName}
                        onChange={(e) => setLocationName(e.target.value)}
                        required
                    />
                </div>
                <button type="submit">Создать пользователя</button>
            </form>
        </div>
    );
};