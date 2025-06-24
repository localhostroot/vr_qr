import React, { useState, useEffect } from 'react';
import style from './locationmodal.module.css';
import logo from '../../assets/images/smallLogo.svg'
import {useResponsive} from "../../utils/responsiveContext";

const LocationModal = ({ location, onClose }) => {
    const [devices, setDevices] = useState([]);
    const API_BASE_URL = process.env.REACT_APP_STATS_DATABASE;
    const { isPhone, isTablet, isDesktop } = useResponsive()

    useEffect(() => {
        const fetchDevices = async () => {
            const token = localStorage.getItem('token');
            try {
                const response = await fetch(`${API_BASE_URL}api/devices/?location=${location.id}`, {
                    headers: {
                        'Authorization': `Token ${token}`
                    }
                });
                if (!response.ok) {
                    throw new Error('Не удалось получить девайсы');
                }
                const data = await response.json();
                setDevices(data);
            } catch (error) {
                console.error('Ошибка при получении девайсов:', error);
            }
        };

        fetchDevices();
    }, [location.id]);

    return (
        <div className={style.modalOverlay}>
            <div className={style.deviceModal}>
                <h2>Шлемы локации "{location.name}"</h2>
                <div className={`${isPhone && style.deviceListPhone} ${isDesktop && style.deviceList} ${isTablet && style.deviceListTablet}`}>
                    {devices.map(device => (
                        <div className={style.singleDevice} key={device.id}>
                            <div className={style.upper}>
                                <img src={logo} alt="vr" />
                                <div>VR-{device.client_id}</div>
                            </div>
                            <h3>Просмотров: {device.views}</h3>
                        </div>
                    ))}
                </div>
                <button onClick={onClose}>Close</button>
            </div>
        </div>
    );
};

export default LocationModal;