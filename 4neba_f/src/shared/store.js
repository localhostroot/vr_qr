import {combineReducers, createStore} from 'redux';
import LOCAL_STORAGE_KEYS from './constants/localStorageKeys';
import clientsReducer from "./reducers/clientsReducer.js";
import queueReducer from "./reducers/queueReducer.js";
import sliderReducer from "./reducers/sliderReducer.js";

const loadQueueFromLocalStorage = () => {
    try {
        const serializedQueue = localStorage.getItem(LOCAL_STORAGE_KEYS.QUEUE);
        if (serializedQueue === null) {
            return undefined;
        }
        return JSON.parse(serializedQueue);
    } catch (err) {
        console.error("Error loading queue from localStorage:", err);
        return undefined;
    }
};


const loadSliderFromLocalStorage = () => {
    try {
        const serializedSlider = localStorage.getItem(LOCAL_STORAGE_KEYS.SLIDER_INDEX);
        if (serializedSlider === null) {
            return undefined;
        }
        return parseInt(serializedSlider, 10);
    } catch (err) {
        console.error("Error loading slider index from localStorage:", err);
        return undefined;
    }
};

const loadClientsFromLocalStorage = () => {
    try {
        const serializedClients = localStorage.getItem(LOCAL_STORAGE_KEYS.CLIENTS);
        if (serializedClients === null) {
            return undefined;
        }
        return JSON.parse(serializedClients);
    } catch (err) {
        console.error("Error loading clients from localStorage:", err);
        return undefined;
    }
};

const persistedQueue = loadQueueFromLocalStorage();
const persistedSliderIndex = loadSliderFromLocalStorage();
const persistedClients = loadClientsFromLocalStorage();

const initialQueueState = {
    queue: persistedQueue || []
};

const initialSliderState = {
    currentSlideIndex: persistedSliderIndex || 0,
};


const initialClientsState = {
    clients: persistedClients || [],
    isLoading: true,
    error: null,
};

const rootReducer = combineReducers({
    queue: queueReducer,
    slider: sliderReducer,
    clients: clientsReducer,
});


const initialState = {
    queue: initialQueueState,
    slider: initialSliderState,
    clients: initialClientsState
};

const store = createStore(rootReducer, initialState);

store.subscribe(() => {
    const state = store.getState();
    const clients = state.clients.clients;

    try {
        const serializedClients = JSON.stringify(clients);
        localStorage.setItem(LOCAL_STORAGE_KEYS.CLIENTS, serializedClients);
    } catch (err) {
        console.error("Error saving clients to localStorage:", err);
    }
});

export default store;