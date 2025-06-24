import style from './contentcardbig.module.scss'
import {useNavigate} from "react-router-dom";
import {AddToQueueBtn} from "@/shared/components/AddToQueueBtn/AddToQueueBtn.jsx";




export const ContentCardBig = ({item}) => {

    const navigate = useNavigate()

    const handleClick = () => {
        item.series ? navigate(`/film/${item.route_id}`) : navigate(`/content/${item.route_id}`)
    }


    return (
        <div className={style.contentCard} onClick={handleClick}>
            <div
                className={style.afisha}
                style={{
                    backgroundImage: `url(${item.queueImg})`,
                }}
            >
                <div className={style.afishaInfo}>
                    <div className={style.format}>
                        {item.format}
                    </div>
                    <AddToQueueBtn item={item}/>
                </div>
                <div className={style.afishaBottomInfo}>
                    <div className={style.time}>
                        {item.time}
                    </div>
                </div>
            </div>
            <div className={style.bottomInfo}>
                <div className={style.name}>{item.name}</div>
                <div className={style.price}>{item.price}₽</div>
            </div>
        </div>
    )
}