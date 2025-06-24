import { useState, useEffect, useRef } from 'react';

const useClientData = (location, clientId) => {
    const [clientData, setClientData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const ws = useRef(null);

    useEffect(() => {
        if (!location || !clientId) {
            console.warn("useClientData: location или/и clientId отсутвуют.");
            setLoading(false);
            return;
        }

        const connectWebSocket = () => {
            ws.current = new WebSocket(`${import.meta.env.VITE_REACT_APP_BACKEND}`);

            ws.current.onopen = () => {
                fetchClientData();
            };

            ws.current.onmessage = (event) => {
                const response = JSON.parse(event.data);

                if (response.error) {
                    setError(response.error);
                    setClientData(null);
                } else {
                    setClientData(response);
                }
            };

            ws.current.onerror = (error) => {
                console.error("useClientData: WebSocket error:", error);
                setError("WebSocket error.");
                setClientData(null);
            };

            ws.current.onclose = () => {
                setError("WebSocket отключен.");
                setClientData(null);
                setTimeout(connectWebSocket, 3000);
            };
        };

        const fetchClientData = () => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                setLoading(true);
                setError(null);

                const message = JSON.stringify({
                    type: 'getClient',
                    clientId: clientId,
                    location: location,
                });
                ws.current.send(message);
            } else {
                console.warn("useClientData: WebSocket не поделючен.");
            }
        };

        connectWebSocket();

        const intervalId = setInterval(() => {
            fetchClientData();
        }, 1000);

        return () => {
            clearInterval(intervalId);
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [clientId, location]);

    return { clientData, loading, error };
};

export default useClientData;