import style from './cardsslider.module.scss'
import React from "react";
import Slider from "react-slick";
import {ContentCard} from "../ContentCard/ContentCard";
import {SerialBlock} from "../SerialBlock/SerialBlock";
import {useDispatch, useSelector} from "react-redux";
import LOCAL_STORAGE_KEYS from "@/shared/constants/localStorageKeys.js";
import {setCurrentSlideIndex} from "@/shared/reducers/sliderReducer.js";



export const CardsSlider = ({library}) =>  {

    const dispatch = useDispatch();
    const currentSlide = useSelector(state => state.slider.currentSlideIndex);


    const settings = {
        dots: true,
        infinite: true,
        speed: 500,
        slidesToShow: 1,
        slidesToScroll: 1,
        arrows: false,
        initialSlide: currentSlide,
        afterChange: (index) => {
            localStorage.setItem(LOCAL_STORAGE_KEYS.SLIDER_INDEX, index.toString());
            dispatch(setCurrentSlideIndex(index));
        },
    };


    return (
        <div className={style.slider}>
            <Slider {...settings}>
                { library
                    && library.map((item) => !item.serial ? (
                        <ContentCard item={item}/>
                    ) : (
                        <SerialBlock item={item}/>
                    ))
                }
            </Slider>
        </div>
    );
}