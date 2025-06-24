import React, { useState } from 'react';
import style from './editusermodal.module.css';

export const EditUserModal = ({ user, onClose, onUserUpdated }) => {
    const databaseApi = process.env.REACT_APP_ADMIN_DATABASE
    const [username, setUsername] = useState(user.username);
    const [email, setEmail] = useState(user.email || '');
    const [firstName, setFirstName] = useState(user.first_name || '');
    const [lastName, setLastName] = useState(user.last_name || '');
    const [isActive, setIsActive] = useState(user.is_active);
    const [location, setLocation] = useState(user.profile.location || '');
    const [locationName, setLocationName] = useState(user.profile.location_name || '');
    const [error, setError] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${databaseApi}users/${user.id}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`,
                },
                body: JSON.stringify({
                    username: username,
                    is_active: isActive,
                    profile: {
                        location: location,
                        location_name: locationName,
                    },
                }),
            });

            if (response.ok) {
                console.log('Пользователь успешно отредактирован!');
                const updatedUserData = await response.json();
                onUserUpdated(updatedUserData);
                onClose();
            } else {
                const errorData = await response.json();
                setError(`Ошибка при редактировании пользователя: ${JSON.stringify(errorData)}`);
            }
        } catch (e) {
            setError(`Произошла ошибка: ${e.message}`);
        }
    };

    return (
        <div className={style.modalOverlay}>
            <div className={style.modal}>
                <button className={style.closeButton} onClick={onClose}>
                    &times;
                </button>
                <h2>Редактирование пользователя</h2>
                {error && <div className={style.error}>{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className={style.formEl}>
                        <label htmlFor="username">Имя пользователя:</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
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
                        />
                    </div>
                    <div className={style.formEl}>
                        <label htmlFor="locationName">Название локации:</label>
                        <input
                            type="text"
                            id="locationName"
                            value={locationName}
                            onChange={(e) => setLocationName(e.target.value)}
                        />
                    </div>
                    <div className={style.formEl}>
                        <label htmlFor="isActive">Активен:</label>
                        <input
                            type="checkbox"
                            id="isActive"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                        />
                    </div>
                    <button type="submit">Сохранить</button>
                </form>
            </div>
        </div>
    );
};