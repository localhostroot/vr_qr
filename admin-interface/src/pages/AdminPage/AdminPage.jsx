import style from './adminpage.module.css'

import React, { useState, useEffect } from 'react';
import {ClientList} from "../../components/ClientList/ClientList";
import NotiModal from "../../ui/NotiModal/NotiModal";
import VideoSelectModal from "../../ui/VideoSelectModal/VideoSelectModal";
import useSendCommand from "../../utils/hooks/useSendCommand";
import useWebSocket from "../../utils/hooks/useWebSocket";
import {StatBlock} from "../../ui/StatBlock/StatBlock";



export const AdminPage = ({onLogout}) => {
    const location = localStorage.getItem('location');
    const [selectedClientIds, setSelectedClientIds] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isVideoSelectModalOpen, setIsVideoSelectModalOpen] = useState(false);

    const [isFreeServer, setIsFreeServer] = useState(() => {
        const storedValue = localStorage.getItem(`isFreeServer_${location}`);
        return storedValue === 'true' || false;
    });

    const controlApi = isFreeServer ? process.env.REACT_APP_CONTROL_SERVER_FREE : process.env.REACT_APP_CONTROL_SERVER;

    const { clients, sendMessage } = useWebSocket(controlApi, location);

    useEffect(() => {
        localStorage.setItem(`isFreeServer_${location}`, String(isFreeServer));
    }, [isFreeServer, location]);

    const { sendCommand } = useSendCommand(sendMessage, location);

    const handleClientSelectionChange = (selectedIds) => {
        setSelectedClientIds(selectedIds);
    };

    const openModal = () => {
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    const handleNotificationSubmit = (message) => {
        selectedClientIds.forEach(clientId => {
            sendCommand('notification', message, null, null, clientId);
        });
        closeModal();
    };

    const openVideoSelectModal = () => {
        setIsVideoSelectModalOpen(true);
    };

    const closeVideoSelectModal = () => {
        setIsVideoSelectModalOpen(false);
    };

    const handleVideoSelect = (videoId) => {
        selectedClientIds.forEach(clientId => {
            sendCommand('videoForClient', null, videoId, null, clientId);
        });
        closeVideoSelectModal();
    };

    const handleStop = () => {
        selectedClientIds.forEach(clientId => {
            sendCommand('stop', null, null, null, clientId);
        });
    };

    const handleVideoForClient = () => {
        openVideoSelectModal();
    };

    const handleMainMenu = () => {
        selectedClientIds.forEach(clientId => {
            sendCommand('mainMenu', null, null, null, clientId);
        });
    };

    const handleReset = () => {
        selectedClientIds.forEach(clientId => {
            sendCommand('reset', null, null, null, clientId);
        });
    };

    const handleServer = () => {
        setIsFreeServer(!isFreeServer);
    };

    return (
        <div className={style.headAdminPage}>
            <div className={style.first}>
                <div className={style.send}>
                    <button onClick={handleStop}>Остановить</button>
                    <button onClick={openModal}>Оповещение</button>
                    <button onClick={handleVideoForClient}>Запустить видео</button>
                    <button onClick={handleMainMenu}>Перейти в главное меню</button>
                    <button onClick={handleReset}>Сбросить</button>
                    <button onClick={handleServer}>
                        {isFreeServer ? "Использовать платный сервер" : "Использовать бесплатный сервер"}
                    </button>
                </div>
                <ClientList
                    clients={clients}
                    onClientSelectionChange={handleClientSelectionChange}
                    location={location}
                />
            </div>
            <StatBlock
                location={location}
            />
            <NotiModal
                isOpen={isModalOpen}
                onClose={closeModal}
                onSubmit={handleNotificationSubmit}
            />
            <VideoSelectModal
                isOpen={isVideoSelectModalOpen}
                onClose={closeVideoSelectModal}
                onVideoSelect={handleVideoSelect}
            />
        </div>
    );
};