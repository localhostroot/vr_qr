import style from './moviebottominfo.module.scss'
import {useSelector} from "react-redux";
import {Link, useNavigate} from "react-router-dom";
import {AddToQueueBtn} from "@/shared/components/AddToQueueBtn/AddToQueueBtn.jsx";
import mainActive from '@/assets/images/mainActive.svg'


export const MovieBottomInfo = ({item}) => {
    const clientString = localStorage.getItem('client');
    const client = clientString ? JSON.parse(clientString) : null;
    const clLocation = client?.location || null;
    const id = client?.id || null;
    const userId = clLocation && id ? `${clLocation}/${id}` : null;
    const paidFilms = useSelector((state) => state.paidFilms.paidFilms);
    const isInPaidFilms = paidFilms.some(film => film.film_id === item.film_id);

    const navigate = useNavigate()

    const handleClick = () => {
        if (isInPaidFilms) {
            navigate('/films');
        } else {
            navigate('/queue')
        }
    }

    const queue = useSelector((state) => state.queue.queue);

    const styles = {
        width: '21.6417vw',
        height: '11.19vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255, 0.37)',
        borderRadius: '30px',
    }

    const stylesNone = {
        width: '21.6417vw',
        height: '11.19vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255, 0.37)',
        borderRadius: '30px',
        color: '#171717',
        cursor: 'not-allowed',
        pointerEvents: 'none',
        opacity: '0.3'
    }

    const disabledStyles = {
        opacity: '0.3',
        cursor: 'not-allowed',
        pointerEvents: 'none',
    };

    const isQueueEmpty = queue.length === 0;

    return (
        <div className={style.movieBottomInfo}>
            <div className={style.upperInfo}>
                <div className={style.name}>
                    {item.name_short}
                </div>
                <div className={style.titleWithBtn}>
                    <div className={style.price}>
                        {item.price}₽
                    </div>
                    <div className={style.linkContainer}>
                        <Link to={`/vr/${userId}`}>
                            <div style={styles} className={style.home}>
                                <img src={mainActive} alt='main'/>
                            </div>
                        </Link>
                    </div>
                </div>
                <div className={style.btns}>
                    <div onClick={handleClick} className={style.toQueue}
                         style={isQueueEmpty && !isInPaidFilms ? disabledStyles : {}}>
                        {isInPaidFilms ? <>К покупкам</> : <>Перейти в корзину</>}
                    </div>
                    <AddToQueueBtn item={item} styles={item.serial || isInPaidFilms ? stylesNone : styles}/>
                </div>
            </div>
            <div className={style.bottomInfo}>
                <div className={style.upper}>
                <div className={style.filmName}>
                        <div className={style.infoUpperPar}>
                            <div className={style.par}>Название</div>
                            <div className={style.parDescr}>{item.country}</div>
                        </div>
                        <div className={style.infoUpperPar}>
                            <div className={style.par}>Год</div>
                            <div className={style.parDescr}>{item.year}</div>
                        </div>
                    </div>
                </div>
                <div className={style.middle}>
                    <div className={style.par}>
                        Описание
                    </div>
                    <div className={style.parDescr}>
                        {item.description}
                    </div>
                </div>
                <div className={style.upper} style={{marginBottom: '3.7313vw'}}>
                    <div className={style.filmName}>
                        <div className={style.infoUpperPar}>
                            <div className={style.par}>Длительность</div>
                            <div className={style.parDescr}>{item.time}</div>
                        </div>
                        <div className={style.infoUpperPar}>
                            <div className={style.par}>Цена</div>
                            <div className={style.parDescr}>{item.price}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}