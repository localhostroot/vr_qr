import style from './mainpageheader.module.scss'
import {RightUpperBody} from "./RightUpperBody/RightUpperBody";
import {LeftUpperBody} from "./LeftUpperBody/LeftUpperBody";


export const MainPageHeader = ({scrollFunc}) => {


    return (
        <div className={style.mainPageHeader}>
            <div className={style.upperBody}>
                <LeftUpperBody/>
                <RightUpperBody/>
            </div>
            <div onClick={scrollFunc} className={style.bottomBody}>
                Посмотреть фильмы
            </div>
        </div>
    )
}