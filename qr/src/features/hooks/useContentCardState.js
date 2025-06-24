import { useState, useEffect } from 'react';

const useContentCardState = (client, item) => {
    const [isActive, setIsActive] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [isInQueue, setIsInQueue] = useState(false);
    const [isOtherActive, setIsOtherActive] = useState(false);

    useEffect(() => {
        if (client && client.currentVideoId === item.film_id && client.activity === 1) {
            setIsActive(true);
        } else {
            setIsActive(false);
        }

        if (client && client.pendingQueue && Array.isArray(client.pendingQueue) && client.pendingQueue.length > 0) {
            setIsPending(client.pendingQueue[0] === item.film_id);
        } else {
            setIsPending(false);
        }

        setIsOtherActive(
            client
            && client.currentVideoId !== null
            && client.currentVideoId !== item.film_id
            && client.activity === 1
        );

        if (
            client
            && client.pendingQueue
            && Array.isArray(client.pendingQueue)
            && client.pendingQueue.length > 0
            && client.pendingQueue.includes(item.film_id)
        ) {
            setIsInQueue(true);
        } else {
            setIsInQueue(false);
        }

    }, [client, item.film_id]);

    return {
        isActive,
        setIsActive,
        isPending,
        setIsPending,
        isInQueue,
        setIsInQueue,
        isOtherActive,
        setIsOtherActive,
    };
};

export default useContentCardState;