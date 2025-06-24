import {useCallback, useEffect, useRef} from 'react';

const useSendCommand = (sendMessage, location) => {
    const locationRef = useRef(location);

    useEffect(() => {
        locationRef.current = location;
    }, [location]);

    const sendCommand = useCallback((type, message, videoId, queue, clientId) => {
        const payload = {
            type: type,
            clientId: clientId,
            location: locationRef.current,
            noti: message,
            videoId: videoId,
            queue: queue,
        };
        sendMessage(payload);
    }, [sendMessage]);

    return { sendCommand };
};

export default useSendCommand;