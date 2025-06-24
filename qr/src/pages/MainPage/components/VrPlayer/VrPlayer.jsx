import style from './vrplayer.module.scss';
import {CardsSlider} from "../CardsSlider/CardsSlider.jsx";
import {HeaderWrapper} from "../HeaderWrapper/HeaderWrapper.jsx";


export const VrPlayer = ({library, referense}) => {


    return (
        <div className={style.vrPlayer} ref={referense}>
            <HeaderWrapper/>
            <CardsSlider library={library}/>
        </div>
    )
}