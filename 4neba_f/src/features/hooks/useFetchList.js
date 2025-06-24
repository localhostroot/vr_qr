import { useState, useEffect } from 'react';
import axios from 'axios';

const useFetchList = (apiEndpoint) => {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchList = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await axios.get(apiEndpoint);
                setList(response.data);
            } catch (error) {
                console.error('Ошибка при получении списка элементов:', error);
                setError(error);
            } finally {
                setLoading(false);
            }
        };

        fetchList();
    }, [apiEndpoint]);

    return { list, loading, error };
};

export default useFetchList;