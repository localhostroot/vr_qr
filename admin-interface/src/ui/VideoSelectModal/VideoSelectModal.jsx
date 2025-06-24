import React, { useState, useEffect } from 'react';
import style from './videoselectmodal.module.css';
import {useResponsive} from "../../utils/ResponsiveContext";

const VideoSelectModal = ({ isOpen, onClose, onVideoSelect }) => {
    const [videos, setVideos] = useState([]);
    const [selectedVideoId, setSelectedVideoId] = useState(null);
    const databaseApi = process.env.REACT_APP_ADMIN_DATABASE

    const { isPhone, isTablet, isDesktop } = useResponsive()

    useEffect(() => {
        const fetchVideos = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${databaseApi}videos/`, {
                    headers: {
                        'Authorization': `Token ${token}`,
                    },
                });
                if (!response.ok) {
                    throw new Error('Не удалось получить фильмы');
                }
                const data = await response.json();
                setVideos(data);
            } catch (error) {
                console.error('Ошибка при попытке получить фильмы:', error);
            }
        };

        if (isOpen) {
            fetchVideos();
        } else {
            setVideos([]);
        }
    }, [isOpen]);

    const handleVideoClick = (videoId) => {
        setSelectedVideoId(videoId);
    };

    const handleSubmit = () => {
        if (selectedVideoId) {
            onVideoSelect(selectedVideoId);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className={style.modal}>
            <div className={style.modalContent}>
                <h2>Выберите видео</h2>
                <div
                    className={`${isDesktop && style.videoGrid} ${isTablet && style.videoGrid} ${isPhone && style.videoGridPhone}`}
                >
                    {videos.map((video) => (
                        <div
                            style={{backgroundImage: `url(${video.image})`}}
                            key={video.id}
                            className={`${isDesktop && style.videoItem} ${isTablet && style.videoItem} ${isPhone && style.videoItemPhone}
                             ${selectedVideoId === video.video_id ? style.selected : ''}`}
                            onClick={() => handleVideoClick(video.video_id)}
                        >
                        </div>
                    ))}
                </div>
                <button onClick={handleSubmit} disabled={!selectedVideoId}>
                    Отправить
                </button>
                <button onClick={onClose}>Отмена</button>
            </div>
        </div>
    );
};

export default VideoSelectModal;