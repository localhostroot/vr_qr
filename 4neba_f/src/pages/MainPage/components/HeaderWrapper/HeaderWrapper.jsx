import style from './headerwrapper.module.scss'
import {Link} from "react-router-dom";
import queActive from "@/assets/images/basketActive.svg";
import React from "react";
import {useSelector} from "react-redux";



export const HeaderWrapper = () => {

    const queue = useSelector((state) => state.queue.queue);

    return (
        <div className={style.headerWrapper}>
            <div className={style.header}>VR PLAYER</div>
            <div className={style.linkContainer}>
                <Link to={`/queue/`}>
                    <div className={style.link}>
                        <img src={queActive} alt='main'/>
                        {queue && queue.length > 0 && <div className={style.queue}></div>}
                    </div>
                </Link>
            </div>
        </div>
    )
}