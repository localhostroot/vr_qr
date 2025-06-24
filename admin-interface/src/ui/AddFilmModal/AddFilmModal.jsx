import React, {useCallback, useState} from 'react';
import style from './addfilmmodal.module.css';
import FilmFormStats from "../FilmFormStats/FilmFormStats";
import FilmFormAdmin from "../FilmFormAdmin/FilmFormAdmin";

const AddFilmModal = ({ onClose }) => {
    const [adminFormData, setAdminFormData] = useState({});
    const [statsFormData, setStatsFormData] = useState({});
    const [applicationFormData, setApplicationFormData] = useState({});

    const handleFormSubmit = async () => {

        const statsFormDataToSend = new FormData();
        for (const key in statsFormData) {
            statsFormDataToSend.append(key, statsFormData[key]);
        }

        try {
            const response = await fetch('http://192.168.1.90:8000/api/create_video_with_category/', {
                method: 'POST',
                body: statsFormDataToSend,
            });
            if (!response.ok) {
                throw new Error(`Ошибка при отправке на Server Stats: ${response.status}`);
            }
            const data = await response.json();
            console.log('Успешно отправлено на Server Stats:', data);
        } catch (error) {
            console.error('Ошибка отправки на Server Stats:', error);
        }

        const adminFormDataToSend = new FormData();
        for (const key in adminFormData) {
            adminFormDataToSend.append(key, adminFormData[key]);
        }

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch('http://192.168.1.90:8001/api/create_video/', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: adminFormDataToSend,
            });
            if (!response.ok) {
                throw new Error(`Ошибка при отправке на Server Admin: ${response.status}`);
            }
            const data = await response.json();
            console.log('Успешно отправлено на Server Admin:', data);
        } catch (error) {
            console.error('Ошибка отправки на Server Admin:', error);
        }
        console.log(JSON.stringify(applicationFormData))
        const applicationCategoryFormDataToSend = new FormData();
        for (const key in applicationFormData.categoryData) {
            applicationCategoryFormDataToSend.append(key, applicationFormData.categoryData[key]);
        }
        const applicationMovieFormDataToSend = new FormData();
        for (const key in applicationFormData.movieData) {
            applicationMovieFormDataToSend.append(key, applicationFormData.movieData[key]);
        }
        onClose();
    };

    const handleLogout = () => {
        onClose();
    }
    const handleAdminFormChange = useCallback((data) => {
        setAdminFormData(data);
    }, []);

    const handleStatsFormChange = useCallback((data) => {
        setStatsFormData(data);
    }, []);

    const handleApplicationFormChange = useCallback((data) => {
        setApplicationFormData(data);
    }, []);

    return (
        <div className={style.modalOverlay}>
            <div className={style.addFilmModal}>
                <h2>Добавить фильм</h2>
                <div className={style.formContainer}>
                    <FilmFormStats onChange={handleStatsFormChange}/>
                    <FilmFormAdmin onChange={handleAdminFormChange}/>
                </div>
                <div className={style.btnDiv}>
                    <button onClick={handleFormSubmit} className={style.closeButton}>
                        Добавить фильм
                    </button>
                    <button onClick={handleLogout} className={style.closeButton}>
                        Закрыть
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddFilmModal;