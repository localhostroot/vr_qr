const initialState = {
    queue: []
};

const queueReducer = (state = initialState, action) => {
    switch (action.type) {
        case 'ADD_TO_QUEUE':
            return {
                ...state,
                queue: [...state.queue, action.payload]
            };
        case 'REMOVE_FROM_QUEUE':
            return {
                ...state,
                queue: state.queue.filter(item => item.id !== action.payload)
            };
        case 'UPDATE_QUEUE':
            return {
                ...state,
                queue: action.payload
            };
        default:
            return state;
    }
};

export default queueReducer;