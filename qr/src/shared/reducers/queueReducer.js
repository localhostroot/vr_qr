const initialState = {
    queue: []
};

const queueReducer = (state = initialState, action) => {
  switch (action.type) {
    case 'ADD_TO_QUEUE':
      const existsInQueue = state.queue.some(item => item.id === action.payload.id);
      if (existsInQueue) {
        return state; 
      }
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
    
    case 'CLEAR_QUEUE': 
      return {
        ...state,
        queue: []
      };
    
    default:
      return state;
  }
};

export default queueReducer;