import style from './vrplayer.module.scss';
import {CardsSlider} from "../CardsSlider/CardsSlider.jsx";
import React from "react";
import {HeaderWrapper} from "@/pages/MainPage/components/HeaderWrapper/HeaderWrapper.jsx";


export const VrPlayer = ({library, referense}) => {


    return (
        <div className={style.vrPlayer} ref={referense}>
            <HeaderWrapper/>
            <CardsSlider library={library}/>
        </div>
    )
}