import React, { useState, useEffect } from 'react';
import style from './clientlist.module.css';
import { ClientElement } from '../ClientElement/ClientElement';
import {useResponsive} from "../../utils/ResponsiveContext";

export const ClientList = ({ clients, onClientSelectionChange }) => {
    const [selectedClientIds, setSelectedClientIds] = useState([]);

    const { isPhone, isTablet, isDesktop } = useResponsive()

    const handleClientSelect = (clientId) => {
        setSelectedClientIds((prevSelected) => {
            if (prevSelected.includes(clientId)) {
                return prevSelected.filter((id) => id !== clientId);
            } else {
                return [...prevSelected, clientId];
            }
        });
    };

    const isClientSelected = (clientId) => selectedClientIds.includes(clientId);


    useEffect(() => {
        onClientSelectionChange(selectedClientIds);
    }, [selectedClientIds, onClientSelectionChange]);

    return (
        <div
            className={`${isDesktop && style.clientList} ${isTablet && style.clientListTablet} ${isPhone && style.clientListPhone}`}
        >
            {clients?.length > 0 ? (
                clients.map((client) => {
                    return (
                        <ClientElement
                            key={client.id}
                            client={client}
                            isSelected={isClientSelected(client.id)}
                            onSelect={handleClientSelect}
                        />
                    );
                })
            ) : (
                <p>Нет подключенных клиентов.</p>
            )}
        </div>
    );
};

