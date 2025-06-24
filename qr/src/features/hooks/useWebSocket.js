import { useEffect, useState } from 'react';

const useWebSocket = (api, getVrType) => {
    const [clients, setClients] = useState([]);
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        const ws = new WebSocket(api);
        setSocket(ws);

        const getVr = () => {
            const payload = JSON.stringify({
                type: getVrType,
            });
            ws.send(payload);
        };

        ws.onopen = () => {
            getVr();
            const intervalId = setInterval(getVr, 5000);
            return () => {
                clearInterval(intervalId);
            };
        };

        ws.onmessage = (msg) => {
            try {
                const result = JSON.parse(msg.data);
                setClients(result);
                localStorage.setItem('clients', JSON.stringify(result));
            } catch (error) {
            }
        };

        ws.onerror = (err) => {
        };

        return () => {
            ws.close();
        };
    }, [api, getVrType]);

    return { clients, socket };
};

export default useWebSocket;