import { useDispatch } from 'react-redux';
import { setClients, setLoading, setError } from '@/shared/reducers/clientsReducer.js';
import {useEffect, useState} from "react";

const useWebSocket = (api, getVrType) => {
    const [clientsLocal, setClientsLocal] = useState([]);
    const [socket, setSocket] = useState(null);
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(setLoading(true));

        const ws = new WebSocket(api);
        setSocket(ws);

        const getVr = () => {
            const payload = JSON.stringify({
                type: getVrType,
            });
            console.log("Sending:", payload);
            ws.send(payload);
        };

        ws.onopen = () => {
            console.log("Connected");
            getVr();
            const intervalId = setInterval(getVr, 5000);
            return () => {
                clearInterval(intervalId);
            };
        };

        ws.onmessage = (msg) => {
            try {
                const result = JSON.parse(msg.data);
                console.log("Received:", result);
                setClientsLocal(result);
                dispatch(setClients(result));
            } catch (error) {
                console.error("Error ", error, msg.data);
                dispatch(setError(error.message));
            }
        };

        ws.onerror = (err) => {
            console.error(err);
            dispatch(setError(err.message));
        };

        return () => {
            ws.close();
        };
    }, [api, getVrType, dispatch]);

    return { clients: clientsLocal, socket };
};

export default useWebSocket;