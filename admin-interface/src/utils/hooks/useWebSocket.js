import { useState, useEffect, useRef, useCallback } from 'react';

const useWebSocket = (controlApi, location) => {
    const [socket, setSocket] = useState(null);
    const [clients, setClients] = useState([]);
    const locationRef = useRef(location);
    useEffect(() => {
        locationRef.current = location;
    }, [location]);

    const sendMessage = useCallback((message) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
        } else {
            console.error("WebSocket не подключен.");
        }
    }, [socket]);

    useEffect(() => {
        const ws = new WebSocket(controlApi);

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'getVrList', location: locationRef.current }));
        };

        ws.onmessage = (event) => {
            try {
                const receivedClients = JSON.parse(event.data);
                setClients(receivedClients);
            } catch (error) {
                console.error('Error parsing JSON:', error);
            }
        };

        ws.onclose = () => {
            setTimeout(() => {
                console.log("WebSocket закрыт. Повторное подключение...");
                createWebSocket();
            }, 2000);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        setSocket(ws);

        function createWebSocket() {
            const ws = new WebSocket(controlApi);

            ws.onopen = () => {
                ws.send(JSON.stringify({ type: 'getVrList', location: locationRef.current }));
            };

            ws.onmessage = (event) => {
                try {
                    const receivedClients = JSON.parse(event.data);
                    setClients(receivedClients);
                } catch (error) {
                    console.error('Error parsing JSON:', error);
                }
            };

            ws.onclose = () => {
                setTimeout(() => {
                    console.log("WebSocket закрыт. Повторное подключение...");
                    createWebSocket();
                }, 2000);
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            setSocket(ws);
        }

        return () => {
            if (ws) {
                ws.close();
                setSocket(null);
            }
        };
    }, [controlApi]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                sendMessage({ type: 'getVrList', location: locationRef.current });
            }
        }, 1000);

        return () => clearInterval(intervalId);
    }, [sendMessage, socket]);


    return { clients, sendMessage };
};

export default useWebSocket;