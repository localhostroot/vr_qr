import style from './contentcard.module.scss'
import {useNavigate} from "react-router-dom";
import {AddToQueueBtn} from "@/shared/components/AddToQueueBtn/AddToQueueBtn.jsx";



export const ContentCard = ({item}) => {

    const navigate = useNavigate()

    const handleClick = () => {
        navigate(`/content/${item.route_id}`)
    }

    return (
        <div className={style.mainWrapper}>
            <div className={style.contentCard} onClick={handleClick}>
                <div
                    className={style.afisha}
                    style={{
                        backgroundImage: `url(${item.image})`,
                    }}
                >
                    <img
                        src={item.image}
                        alt='афиша-слайдер'
                    />
                </div>
                <div className={style.afishaInfo}>
                    <AddToQueueBtn item={item}/>
                </div>
                <div className={style.afishaBottomInfo}>
                    <div className={style.time}>
                        {item.time}
                    </div>
                </div>
                <div className={style.bottomInfo}>
                    <div className={style.name}>{item.name}</div>
                    <div className={style.price}>Бесплатно</div>
                </div>
            </div>
        </div>
    )
}