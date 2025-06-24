const SET_CLIENTS = 'SET_CLIENTS';
const SET_LOADING = 'SET_LOADING';
const SET_ERROR = 'SET_ERROR';

export const setClients = (clients) => ({
    type: SET_CLIENTS,
    payload: clients,
});

export const setLoading = (isLoading) => ({
    type: SET_LOADING,
    payload: isLoading,
});

export const setError = (error) => ({
    type: SET_ERROR,
    payload: error,
});

const initialState = {
    clients: [],
    isLoading: true,
    error: null,
};

const clientsReducer = (state = initialState, action) => {
    switch (action.type) {
        case SET_CLIENTS:
            return {
                ...state,
                clients: action.payload,
                isLoading: false,
                error: null,
            };
        case SET_LOADING:
            return {
                ...state,
                isLoading: action.payload,
            };
        case SET_ERROR:
            return {
                ...state,
                error: action.payload,
                isLoading: false,
            };
        default:
            return state;
    }
};

export default clientsReducer;