import { globals } from '$lib/stores/+stores.svelte.js';
import { goto } from '$app/navigation';
import { PUBLIC_DATABASE } from '$env/static/public';
import LOCAL_STORAGE_KEYS from '$lib/constants/localStorageKeys.js';
import axios from 'axios';

export async function initializeMainPageData(location, id) {
  const clients = globals.get('clients');
  const isClientsLoading = globals.get('isClientsLoading');
  const library = globals.get('library');
  const isLibraryLoading = globals.get('isLibraryLoading');

  // Validate client and set localStorage
  const checkClientAndSetLocalStorage = () => {
    if (!location || !id) {
      goto('/');
      return false;
    }

    const storedClient = localStorage.getItem(LOCAL_STORAGE_KEYS.CLIENT);
    if (storedClient) {
      const client = JSON.parse(storedClient);
      if (client.location === location && client.id === id) {
        return true;
      }
    }

    const clientExistsInRedux = clients.some(
      client => client.location === location && client.id === id
    );
    
    if (clientExistsInRedux) {
      const client = { location, id };
      localStorage.setItem(LOCAL_STORAGE_KEYS.CLIENT, JSON.stringify(client));
      globals.set('currentClient', client);
      return true;
    } else {
      goto('/');
      return false;
    }
  };

  // Load library if needed
  const loadLibrary = async () => {
    if (!library && !isLibraryLoading) {
      globals.set('isLibraryLoading', true);
      try {
        const apiUrl = `${PUBLIC_DATABASE}api/category/`;
        const response = await axios.get(apiUrl);
        globals.set('library', response.data);
        return response.data;
      } catch (error) {
        console.error('Failed to load library:', error);
        globals.set('library', null);
        return null;
      } finally {
        globals.set('isLibraryLoading', false);
      }
    }
    return library;
  };

  // Wait for clients to load before validating
  if (!isClientsLoading && clients.length >= 0) {
    const isValidClient = checkClientAndSetLocalStorage();
    if (!isValidClient) {
      return { isValid: false };
    }
  }

  // Load library
  const libraryData = await loadLibrary();

  return {
    isValid: true,
    library: libraryData,
    isLibraryLoading: globals.get('isLibraryLoading'),
    isClientsLoading: globals.get('isClientsLoading'),
    location,
    id
  };
}
