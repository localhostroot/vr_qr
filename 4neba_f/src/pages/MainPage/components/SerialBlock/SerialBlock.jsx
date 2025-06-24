import style from './serialblock.module.scss';
import {useNavigate} from "react-router-dom";
import vector from "@/assets/images/vector.svg";
import React from "react";




export const SerialBlock = ({item}) => {

    const navigate = useNavigate()

    const handleClick = () => {
        navigate(`/content/${item.route_id}`)
    }

    return (
        <div className={style.mainWrapper}>
            <div className={style.wrapper}>
                <img onClick={handleClick} src={`${vector}`} alt='123'/>
                <div className={style.serialBlock} onClick={handleClick} style={{
                    backgroundImage: `url(${item.image})`
                }}>
                    <div className={style.infoBlock}>
                        <div className={style.infoItem}>{item.number}</div>
                    </div>
                </div>
            </div>
        </div>
    )
}