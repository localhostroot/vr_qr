import style from './addtoqueuebtn.module.scss'
import btnMinus from "@/assets/images/minus.svg";
import btnPlus from "@/assets/images/plus.svg";
import {useEffect, useState} from "react";
import {useDispatch, useSelector} from "react-redux";
import {useNavigate} from "react-router-dom";



export const AddToQueueBtn = ({item, styles}) => {
    const navigate = useNavigate()
    const dispatch = useDispatch();
    const queue = useSelector((state) => state.queue.queue);
    const[isAdded, setIsAdded] = useState(false)

    useEffect(() => {
        const existsInQueue = queue.some(i => i.id === item.id);
        setIsAdded(existsInQueue);
    }, [queue, item.id]);

    const handleToggleQueue = (event) => {
        event.stopPropagation()
        if (item.serial) {
            navigate(`/content/${item.id}`)
        } else {
            if (isAdded) {
                dispatch({ type: 'REMOVE_FROM_QUEUE', payload: item.id });
            } else {
                dispatch({ type: 'ADD_TO_QUEUE', payload: item });
            }
        }
    };

    return (
        <div style={styles} className={style.button} onClick={handleToggleQueue}>
            {isAdded ? (
                <img src={`${btnMinus}`} alt="Удалить из корзины" />
            ) : (
                <img src={`${btnPlus}`} alt="Добавить в корзину" />
            )}
        </div>
    )
}