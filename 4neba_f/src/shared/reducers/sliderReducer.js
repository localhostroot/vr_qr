const initialState = {
    currentSlideIndex: 0,
};

const SLIDER_SET_CURRENT_SLIDE = 'SLIDER_SET_CURRENT_SLIDE';

const sliderReducer = (state = initialState, action) => {
    switch (action.type) {
        case SLIDER_SET_CURRENT_SLIDE:
            return {
                ...state,
                currentSlideIndex: action.payload,
            };
        default:
            return state;
    }
};

export const setCurrentSlideIndex = (index) => ({
    type: SLIDER_SET_CURRENT_SLIDE,
    payload: index,
});

export default sliderReducer;