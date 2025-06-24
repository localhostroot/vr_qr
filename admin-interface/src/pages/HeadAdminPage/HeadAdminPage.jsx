import React, { useState, useEffect } from 'react';
import style from './headadminpage.module.css';
import { UserForm } from '../../components/UserForm/UserForm';
import { UserList } from '../../components/UserList/UserList';
import {useResponsive} from "../../utils/ResponsiveContext";

export const HeadAdminPage = () => {
    const [users, setUsers] = useState([]);
    const databaseApi = process.env.REACT_APP_ADMIN_DATABASE
    const { isPhone, isTablet, isDesktop } = useResponsive()


    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');

            const response = await fetch(`${databaseApi}users/list/`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setUsers(data.filter(user => user.profile.location && user.profile.location_name));
            } else {
                console.error(`Ошибка при получении пользователей: ${response.statusText}`);
                if (response.status === 401) {
                    console.error('Неверный токен. Требуется повторная авторизация.');
                }
            }
        } catch (e) {
            console.error(`Произошла ошибка: ${e.message}`);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleUserCreated = async (newUser) => {
        await fetchUsers();
    };

    const handleDeleteUser = async (userId) => {
        await fetchUsers();
    };

    const handleUserUpdated = async (updatedUser) => {
        await fetchUsers();
    };



    return (
        <div className={`${isDesktop && style.headAdminPage} ${isPhone && style.headAdminPagePhone} ${isTablet && style.headAdminPageTablet}`}>
            <div className={style.funcDiv}>
                <UserForm onUserCreated={handleUserCreated} />
            </div>
            <UserList
                users={users}
                onDelete={handleDeleteUser}
                onUserUpdated={handleUserUpdated}
            />
        </div>
    );
};