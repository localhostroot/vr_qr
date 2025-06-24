import style from './tableelement.module.scss'
import {useNavigate} from "react-router-dom";




export const TableElement = ({item}) => {

    const navigate = useNavigate()

    const handleClick = () => {
        navigate(`/film/${item.route_id}`)
    }


    return (
        <div className={style.tableElement} onClick={handleClick}>
            <div
                className={style.backImg}

            >
                <img src={item.image} alt='серия'/>
            </div>
            <div className={style.info}>
                <div className={style.upperInfo}>
                    <div className={style.name}>
                        <div className={style.filmName}>{item.name}</div>
                        <div className={style.number}>{item.number} серия</div>
                    </div>
                    <div className={style.time}>
                        {item.time}
                    </div>
                </div>
                <div className={style.price}>
                    {item.price}₽
                </div>
            </div>
        </div>
    )
}