import React, { useState } from 'react';
import style from './userelement.module.css';
import {EditUserModal} from "../../ui/EditUserModal/EditUserModal";
import {useNavigate} from "react-router-dom";


export const UserElement = ({ user, onDelete,  onUserUpdated }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const navigate = useNavigate()
    const databaseApi = process.env.REACT_APP_ADMIN_DATABASE



    const handleEditClick = () => {
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleLocation = () => {
        navigate(`/head-admin/${user.profile.location}`)
    };

    const handleDeleteClick = async () => {
        if (window.confirm('Вы уверены, что хотите удалить этого пользователя?')) {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${databaseApi}users/${user.id}/`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Token ${token}`,
                    },
                });

                if (response.ok) {
                    console.log('Пользователь успешно удален!');
                    onDelete(user.id);
                } else {
                    console.error(`Ошибка при удалении пользователя: ${response.status} ${response.statusText}`);
                    alert(`Ошибка при удалении пользователя: ${response.status} ${response.statusText}`);
                }
            } catch (e) {
                console.error(`Произошла ошибка: ${e.message}`);
                alert(`Произошла ошибка: ${e.message}`);
            }
        }
    };

    return (
        <div className={style.userElement}>
            <h3>{user.profile.location_name}</h3>
            <p>Локация: {user.profile.location}</p>
            <p>
                Статус: {user.is_active ? 'Active' : 'Inactive'}
                <span className={style.statusCircle} style={{ backgroundColor: user.is_active ? 'green' : 'red' }}></span>
            </p>
            <div className={style.buttonContainer}>
                <button onClick={handleLocation} className={style.navigateButton}>
                    Перейти
                </button>
                <div className={style.funcBtns}>
                    <button onClick={handleEditClick} className={style.editButton}>
                        Редактировать
                    </button>
                    <button onClick={handleDeleteClick} className={style.deleteButton}>
                        Удалить
                    </button>
                </div>
            </div>
            {isModalOpen && (
                <EditUserModal user={user} onClose={handleCloseModal} onUserUpdated={onUserUpdated} />
            )}
        </div>
    );
};