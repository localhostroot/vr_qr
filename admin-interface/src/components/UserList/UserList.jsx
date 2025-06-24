import React from 'react';
import style from './userlist.module.css';
import { UserElement } from '../UserElement/UserElement';
import {useResponsive} from "../../utils/ResponsiveContext";

export const UserList = ({ users, onDelete, onUserUpdated }) => {

    const { isPhone, isTablet, isDesktop } = useResponsive()


    return (
        <div
            className={`${isDesktop && style.userList} ${isPhone && style.userListPhone} ${isTablet && style.userListTablet}`}
        >
            <h2>Список пользователей</h2>
            <div className={style.userGrid}>
                {users.map(user => (
                    <UserElement
                        key={user.id}
                        user={user}
                        onDelete={onDelete}
                        onUserUpdated={onUserUpdated}
                    />
                ))}
            </div>
        </div>
    );
};