import style from './contentcard.module.scss'
import {useNavigate} from "react-router-dom";
import {AddToQueueBtn} from "@/shared/components/AddToQueueBtn/AddToQueueBtn.jsx";
import {useSelector} from "react-redux";



export const ContentCard = ({item}) => {
    const paidFilms = useSelector((state) => state.paidFilms.paidFilms);
    const isInPaidFilms = paidFilms.some(film => film.film_id === item.film_id);
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
                </div>
                <div className={style.afishaInfo}>
                    {!isInPaidFilms && <AddToQueueBtn item={item}/>}
                </div>
                <div className={style.afishaBottomInfo}>
                    <div className={style.time}>
                        {item.time}
                    </div>
                </div>
                <div className={style.bottomInfo}>
                    <div className={style.name}>{item.name}</div>
                    <div className={style.price}>free</div>
                </div>
            </div>
        </div>
    )
}