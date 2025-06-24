import { useState, useEffect } from 'react';
import axios from 'axios';

const useFetchItem = (apiEndpoint, id, itemType = 'movie') => {
    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchItem = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await axios.get(apiEndpoint);
                const foundItem = response.data.find(item => item.route_id === id);

                if (foundItem) {
                    setItem(foundItem);
                } else {
                    console.warn(`Элемент типа ${itemType} с route_id ${id} не найден.`);
                }
            } catch (error) {
                console.error(`Ошибка при получении данных элемента типа ${itemType} с route_id ${id}:`, error);
                setError(error);
            } finally {
                setLoading(false);
            }
        };

        fetchItem();
    }, [apiEndpoint, id, itemType]);

    return { item, loading, error };
};

export default useFetchItem;