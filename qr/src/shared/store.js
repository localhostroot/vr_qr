import {combineReducers, createStore} from 'redux';
import LOCAL_STORAGE_KEYS from './constants/localStorageKeys';
import paidFilmsReducer from "@/shared/reducers/paidFilmsReducer.js";
import queueReducer from "@/shared/reducers/queueReducer.js";
import sliderReducer from "@/shared/reducers/sliderReducer.js";
import clientsReducer from "@/shared/reducers/clientsReducer.js";
import tokenReducer from '@/shared/reducers/tokenReducer';


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

const loadPaidFilmsFromLocalStorage = () => {
    try {
        const serializedPaidFilms = localStorage.getItem(LOCAL_STORAGE_KEYS.PAID_FILMS);
        if (serializedPaidFilms === null) {
            return undefined;
        }
        return JSON.parse(serializedPaidFilms);
    } catch (err) {
        console.error("Error loading paidFilms from localStorage:", err);
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
const persistedPaidFilms = loadPaidFilmsFromLocalStorage();
const persistedSliderIndex = loadSliderFromLocalStorage();
const persistedClients = loadClientsFromLocalStorage();


const initialQueueState = {
    queue: persistedQueue || []
};
const initialPaidFilmsState = {
    paidFilms: persistedPaidFilms || []
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
    paidFilms: paidFilmsReducer,
    slider: sliderReducer,
    clients: clientsReducer,
    token: tokenReducer,
});


const initialState = {
    queue: initialQueueState,
    paidFilms: initialPaidFilmsState,
    slider: initialSliderState,
    clients: initialClientsState
};

const store = createStore(rootReducer, initialState);

store.subscribe(() => {
    const state = store.getState();
    const clients = state.clients.clients;
    const queue = state.queue.queue;
    const paidFilms = state.paidFilms.paidFilms; 

    try {
        const serializedClients = JSON.stringify(clients);
        localStorage.setItem(LOCAL_STORAGE_KEYS.CLIENTS, serializedClients);
    } catch (err) {
        console.error("Error saving clients to localStorage:", err);
    }

    try {
        const serializedQueue = JSON.stringify(queue);
        localStorage.setItem(LOCAL_STORAGE_KEYS.QUEUE, serializedQueue);
    } catch (err) {
        console.error("Error saving queue to localStorage:", err);
    }

    try {
        const serializedPaidFilms = JSON.stringify(paidFilms);
        localStorage.setItem(LOCAL_STORAGE_KEYS.PAID_FILMS, serializedPaidFilms);
    } catch (err) {
        console.error("Error saving paidFilms to localStorage:", err);
    }
});


export default store;