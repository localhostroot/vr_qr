import { browser } from '$app/environment';
import LOCAL_STORAGE_KEYS from '$lib/constants/localStorageKeys.js';

// Helper functions for localStorage
const loadFromLocalStorage = (key, defaultValue = null) => {
  if (!browser) return defaultValue;
  
  try {
      const item = localStorage.getItem(key);
      if (item === null) {
          return defaultValue;
      }
      return JSON.parse(item);
  } catch (err) {
      console.error(`Error loading ${key} from localStorage:`, err);
      return defaultValue;
  }
};

const saveToLocalStorage = (key, value) => {
  if (!browser) return;
  
  try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
  } catch (err) {
      console.error(`Error saving ${key} to localStorage:`, err);
  }
};

// Load initial data from localStorage (matching React version)
const persistedQueue = loadFromLocalStorage(LOCAL_STORAGE_KEYS.QUEUE, []);
const persistedPaidFilms = loadFromLocalStorage(LOCAL_STORAGE_KEYS.PAID_FILMS, []);
const persistedSliderIndex = loadFromLocalStorage(LOCAL_STORAGE_KEYS.SLIDER_INDEX, 0);
const persistedClients = loadFromLocalStorage(LOCAL_STORAGE_KEYS.CLIENTS, []);
// Token is handled by tokenReducer pattern - load directly from localStorage
const persistedToken = browser ? localStorage.getItem(LOCAL_STORAGE_KEYS.PAYMENT_TOKEN) : null;
const persistedTokenExpiry = browser ? localStorage.getItem(LOCAL_STORAGE_KEYS.TOKEN_EXPIRY) : null;
const persistedClient = loadFromLocalStorage(LOCAL_STORAGE_KEYS.CLIENT, null);

let globalStorage = $state({

  version: '0.12.3',

  // Queue management
  queue: persistedQueue,
  
  // Paid films management
  paidFilms: persistedPaidFilms,
  
  // Slider state
  currentSlideIndex: persistedSliderIndex,
  
  // Clients state
  clients: persistedClients,
  isClientsLoading: true,
  clientsError: null,
  
  // Token state
  token: persistedToken,
  tokenExpiry: persistedTokenExpiry,
  
  // Library data
  library: null,
  isLibraryLoading: false,
  
  // Current client info
  currentClient: persistedClient,
  
  // WebSocket connection
  socket: null,
  
  // Payment status
  isPaymentLoading: false,
  paymentError: null
});

function getGlobals() {

  function update(item, handler) {
  globalStorage[item] = handler(globalStorage[item]);
  
  // Auto-persist to localStorage for specific items
  if (item === 'queue') {
    saveToLocalStorage(LOCAL_STORAGE_KEYS.QUEUE, globalStorage[item]);
  } else if (item === 'paidFilms') {
    saveToLocalStorage(LOCAL_STORAGE_KEYS.PAID_FILMS, globalStorage[item]);
  } else if (item === 'clients') {
    saveToLocalStorage(LOCAL_STORAGE_KEYS.CLIENTS, globalStorage[item]);
  } else if (item === 'currentSlideIndex') {
    saveToLocalStorage(LOCAL_STORAGE_KEYS.SLIDER_INDEX, globalStorage[item]);
  } else if (item === 'token') {
    saveToLocalStorage(LOCAL_STORAGE_KEYS.PAYMENT_TOKEN, globalStorage[item]);
  } else if (item === 'tokenExpiry') {
    saveToLocalStorage(LOCAL_STORAGE_KEYS.TOKEN_EXPIRY, globalStorage[item]);
  } else if (item === 'currentClient') {
    saveToLocalStorage(LOCAL_STORAGE_KEYS.CLIENT, globalStorage[item]);
  }
  }

  return {

  get(item) {
    return globalStorage[item]
  },

  set(item, value) {
    globalStorage[item] = value;
    
    // Auto-persist to localStorage for specific items
    if (item === 'queue') {
      saveToLocalStorage(LOCAL_STORAGE_KEYS.QUEUE, value);
    } else if (item === 'paidFilms') {
      saveToLocalStorage(LOCAL_STORAGE_KEYS.PAID_FILMS, value);
    } else if (item === 'clients') {
      saveToLocalStorage(LOCAL_STORAGE_KEYS.CLIENTS, value);
    } else if (item === 'currentSlideIndex') {
      saveToLocalStorage(LOCAL_STORAGE_KEYS.SLIDER_INDEX, value);
    } else if (item === 'token') {
      saveToLocalStorage(LOCAL_STORAGE_KEYS.PAYMENT_TOKEN, value);
    } else if (item === 'tokenExpiry') {
      saveToLocalStorage(LOCAL_STORAGE_KEYS.TOKEN_EXPIRY, value);
    } else if (item === 'currentClient') {
      saveToLocalStorage(LOCAL_STORAGE_KEYS.CLIENT, value);
    }
  },

  update,

  // Redux-style action methods
  // Queue actions (matching queueReducer)
  addToQueue(item) {
    const existsInQueue = globalStorage.queue.some(queueItem => queueItem.id === item.id);
    if (!existsInQueue) {
      globalStorage.queue = [...globalStorage.queue, item];
      saveToLocalStorage(LOCAL_STORAGE_KEYS.QUEUE, globalStorage.queue);
    }
  },

  removeFromQueue(itemId) {
    globalStorage.queue = globalStorage.queue.filter(item => item.id !== itemId);
    saveToLocalStorage(LOCAL_STORAGE_KEYS.QUEUE, globalStorage.queue);
  },

  updateQueue(newQueue) {
    globalStorage.queue = newQueue;
    saveToLocalStorage(LOCAL_STORAGE_KEYS.QUEUE, globalStorage.queue);
  },

  clearQueue() {
    globalStorage.queue = [];
    saveToLocalStorage(LOCAL_STORAGE_KEYS.QUEUE, globalStorage.queue);
  },

  // Clients actions (matching clientsReducer)
  setClients(clients) {
    globalStorage.clients = clients;
    globalStorage.isClientsLoading = false;
    globalStorage.clientsError = null;
    saveToLocalStorage(LOCAL_STORAGE_KEYS.CLIENTS, globalStorage.clients);
  },

  setClientsLoading(isLoading) {
    globalStorage.isClientsLoading = isLoading;
  },

  setClientsError(error) {
    globalStorage.clientsError = error;
    globalStorage.isClientsLoading = false;
  },

  // Token actions (matching tokenReducer)
  setToken(token, expiry) {
    globalStorage.token = token;
    globalStorage.tokenExpiry = expiry;
    saveToLocalStorage(LOCAL_STORAGE_KEYS.PAYMENT_TOKEN, token);
    saveToLocalStorage(LOCAL_STORAGE_KEYS.TOKEN_EXPIRY, expiry);
  },

  removeToken() {
    globalStorage.token = null;
    globalStorage.tokenExpiry = null;
    if (browser) {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.PAYMENT_TOKEN);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.TOKEN_EXPIRY);
    }
  },

  // Slider actions (matching sliderReducer)
  setCurrentSlideIndex(index) {
    globalStorage.currentSlideIndex = index;
    saveToLocalStorage(LOCAL_STORAGE_KEYS.SLIDER_INDEX, index);
  }
  }
}

export const globals = getGlobals();
