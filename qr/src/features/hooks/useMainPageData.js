import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import LOCAL_STORAGE_KEYS from "../../shared/constants/localStorageKeys.js";

const useMainPageData = () => {
    const [library, setLibrary] = useState(null);
    const [isLibraryLoading, setIsLibraryLoading] = useState(true);
    const navigate = useNavigate();
    const databaseApi = import.meta.env.VITE_REACT_APP_DATABASE;
    const apiUrl = `${databaseApi}api/category/`;
    const clients = useSelector(state => state.clients.clients);
    const isLoading = useSelector(state => state.clients.isLoading);
    const { location: urlLocation, id: urlId } = useParams();

    useEffect(() => {
        const fetchLibrary = async () => {
            setIsLibraryLoading(true);
            try {
                const response = await axios.get(apiUrl);
                setLibrary(response.data);
            } catch (error) {
                setLibrary(null);
            } finally {
                setIsLibraryLoading(false);
            }
        };

        fetchLibrary();
    }, [apiUrl]);

    useEffect(() => {
        const checkClientAndSetLocalStorage = () => {
            if (!urlLocation || !urlId) {
                navigate('/not-found');
                return;
            }

            const storedClient = localStorage.getItem(LOCAL_STORAGE_KEYS.CLIENT);
            if (storedClient) {
                const client = JSON.parse(storedClient);
                if (client.location === urlLocation && client.id === urlId) {
                    return;
                }
            }

            const clientExistsInRedux = clients.some(
                client => client.location === urlLocation && client.id === urlId
            );
            if (clientExistsInRedux) {
                const client = { location: urlLocation, id: urlId };
                localStorage.setItem(LOCAL_STORAGE_KEYS.CLIENT, JSON.stringify(client));
            } else {
                navigate('/not-found');
            }
        };

        if (!isLibraryLoading && !isLoading) {
            checkClientAndSetLocalStorage();
        }
    }, [urlLocation, urlId, clients, navigate, isLibraryLoading, isLoading]);

    return {
        library,
        isLibraryLoading,
        isLoading,
        urlLocation,
        urlId
    };
};

export default useMainPageData;