import LOCAL_STORAGE_KEYS from "@/shared/constants/localStorageKeys.js";

const initialState = {
    token: localStorage.getItem(LOCAL_STORAGE_KEYS.PAYMENT_TOKEN) || null,
    tokenExpiry: localStorage.getItem(LOCAL_STORAGE_KEYS.TOKEN_EXPIRY) || null
};

const tokenReducer = (state = initialState, action) => {
    switch (action.type) {
        case 'SET_TOKEN':
            localStorage.setItem(LOCAL_STORAGE_KEYS.PAYMENT_TOKEN, action.payload.token);
            localStorage.setItem(LOCAL_STORAGE_KEYS.TOKEN_EXPIRY, action.payload.expiry);
            return {
                ...state,
                token: action.payload.token,
                tokenExpiry: action.payload.expiry
            };
        case 'REMOVE_TOKEN':
            localStorage.removeItem(LOCAL_STORAGE_KEYS.PAYMENT_TOKEN);
            localStorage.removeItem(LOCAL_STORAGE_KEYS.TOKEN_EXPIRY);
            return {
                ...state,
                token: null,
                tokenExpiry: null
            };
        default:
            return state;
    }
};

export default tokenReducer;