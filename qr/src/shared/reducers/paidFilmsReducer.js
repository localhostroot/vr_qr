const initialState = {
    paidFilms: []
};

const paidFilmsReducer = (state = initialState, action) => {
    switch (action.type) {
        case 'ADD_PAID_FILM':
            const existsInPaidFilms = state.paidFilms.some(film => film.film_id === action.payload.film_id);
            if (existsInPaidFilms) {
                return state; 
            }
            return {
                ...state,
                paidFilms: [...state.paidFilms, action.payload]
            };
        case 'REMOVE_PAID_FILM':
            return {
                ...state,
                paidFilms: state.paidFilms.filter(film => film.id !== action.payload)
            };
        case 'SET_PAID_FILMS':
            return {
                ...state,
                paidFilms: action.payload
            };
        default:
            return state;
    }
};

export default paidFilmsReducer;