import React, { useState, useEffect } from 'react';
import style from './clientelement.module.css';
import logo from '../../assets/images/smallLogo.svg';
import {useResponsive} from "../../utils/ResponsiveContext";

export const ClientElement = ({ client, isSelected, onSelect }) => {
    const [videos, setVideos] = useState([]);
    const databaseApi = process.env.REACT_APP_ADMIN_DATABASE

    const { isPhone, isTablet, isDesktop } = useResponsive()


    useEffect(() => {
        const fetchVideos = async () => {
            try {
                const token = localStorage.getItem('token');

                if (!token) {
                    console.log('Пользователь не аутентифицирован, токен отсутствует.');
                    setVideos([]);
                    return;
                }

                const response = await fetch(`${databaseApi}videos/`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Token ${token}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        console.log('Токен недействителен или истек, перенаправляем на вход.');
                        localStorage.removeItem('token');
                    } else {
                        throw new Error(`Не удалось получить фильмы: ${response.status}`);
                    }
                }

                const data = await response.json();
                setVideos(data);
            } catch (error) {
                console.error('Не удалось получить фильмы:', error);
            }
        };

        fetchVideos();
    }, []);

    const handleSelect = () => {
        onSelect(client.id);
    };

    console.log(client.id);
    console.log(client);

    let statusText = 'Status';

    if (client.activity === 0 || client.activity === 2) {
        statusText = 'В меню';
    } else if (client.activity === 1) {
        const currentVideo = videos.find((video) => video.video_id === client.currentVideoId);

        if (currentVideo) {
            const playbackPosition = Math.round(client.playbackPosition);
            const minutes = Math.floor(playbackPosition / 60);
            const seconds = playbackPosition % 60;
            const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            statusText = (
                <>
                    <div style={{width: "150px"}}>{currentVideo.title}</div>
                    <div style={{color: "white"}}>{formattedTime} / {currentVideo.timer}</div>
                </>
            );
        } else {
            statusText = (
                <>
                    <div>Видео не найдено</div>
                    <div>00:00/timer</div>
                </>
            );
        }
    }

    return (
        <div
            className={`${isDesktop && style.clientElement} 
            ${isTablet && style.clientElement} 
            ${isPhone && style.clientElementPhone} ${isSelected ? style.selected : ''}`}
            onClick={handleSelect}
        >
            <div className={style.upperInfo}>
                <img src={logo} alt={'vr'} />
                <h3>VR-{client.id}</h3>
            </div>
            <div>{statusText}</div>
        </div>
    );
};