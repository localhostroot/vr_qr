import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import style from './headadminlocationpage.module.css';
import { ClientList } from '../../components/ClientList/ClientList';
import NotiModal from '../../ui/NotiModal/NotiModal';
import VideoSelectModal from "../../ui/VideoSelectModal/VideoSelectModal";
import useWebSocket from "../../utils/hooks/useWebSocket";
import useSendCommand from "../../utils/hooks/useSendCommand";
import QrCodeRangeModal from "../../ui/QrCodeRangeModal/QrCodeRangeModal";
import pdfMake from 'pdfmake/build/pdfmake';
import QRCode from 'qrcode';
import {StatBlock} from "../../ui/StatBlock/StatBlock";




export const HeadAdminLocationPage = ({ onLogout }) => {

    const { location } = useParams();

    const [selectedClientIds, setSelectedClientIds] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isVideoSelectModalOpen, setIsVideoSelectModalOpen] = useState(false);
    const [isQrCodeModalOpen, setIsQrCodeModalOpen] = useState(false);
    const [isFreeServer, setIsFreeServer] = useState(() => {
        const storedValue = localStorage.getItem(`isFreeServer_${location}`);
        return storedValue === 'true' || false;
    });

    const controlApi = isFreeServer ? process.env.REACT_APP_CONTROL_SERVER_FREE : process.env.REACT_APP_CONTROL_SERVER;
    const vrUrlBase = isFreeServer ? process.env.REACT_APP_VR_URL_BASE_FREE : process.env.REACT_APP_VR_URL_BASE;




    const { clients, sendMessage } = useWebSocket(controlApi, location);
    const { sendCommand } = useSendCommand(sendMessage, location);

    useEffect(() => {
        localStorage.setItem(`isFreeServer_${location}`, String(isFreeServer));
    }, [isFreeServer, location]);

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

    const openQrCodeModal = () => {
        setIsQrCodeModalOpen(true);
    };

    const closeQrCodeModal = () => {
        setIsQrCodeModalOpen(false);
    };


    const handleGenerateQrCodes = async ({ min, max }) => {
        const qrCodeData = [];

        for (let id = min; id <= max; id++) {
            const qrCodeUrl = `${vrUrlBase}vr/${location}/${id}`;
            console.log("QR URL", qrCodeUrl);

            try {
                const qrCodeImage = await QRCode.toDataURL(qrCodeUrl);
                qrCodeData.push({ image: qrCodeImage, width: 150 });
            } catch (err) {
                console.error("Error", err);
            }
        }

        const tableBody = [];
        for (let i = 0; i < qrCodeData.length; i += 3) {
            const row = [];
            for (let j = 0; j < 3; j++) {
                if (qrCodeData[i + j]) {
                    row.push(qrCodeData[i + j]);
                } else {
                    row.push({});
                }
            }
            tableBody.push(row);
        }

        const documentDefinition = {
            content: [
                {
                    table: {
                        body: tableBody
                    },
                    layout: 'noBorders'
                }
            ],
            pageSize: 'A4',
            pageMargins: [40, 60, 40, 60],
        };

        const pdfDocGenerator = pdfMake.createPdf(documentDefinition);
        pdfDocGenerator.getBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `qr_codes_${location}_${min}_${max}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
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
                    <button onClick={openQrCodeModal}>Создать QR-коды</button>
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
            <QrCodeRangeModal
                isOpen={isQrCodeModalOpen}
                onClose={closeQrCodeModal}
                onSubmit={handleGenerateQrCodes}
            />
        </div>
    );
};