import style from './queuepage.module.scss'
import {useSelector} from "react-redux";
import {useNavigate} from "react-router";
import {useEffect, useState} from "react";
import {Header} from "../../../../../4neba_f/src/widgets/Header/index.js";
import {ContentCardBig} from "../components/ContentCardBig/ContentCardBig";
import {Modal} from "../components/Modal/Modal";
import mainActive from "@/assets/images/mainActive.svg";



const QueuePage = () => {
    const queue = useSelector((state) => state.queue.queue);
    const navigate = useNavigate()
    const clientString = localStorage.getItem('client');
    const client = clientString ? JSON.parse(clientString) : null;
    const clLocation = client?.location || null;
    const id = client?.id || null;
    const userId = clLocation && id ? `${clLocation}/${id}` : null;




    const handleClick = () => {
        if (client) {
            navigate(`/vr/${userId}`)
        } else  {
            navigate('/vr')
        }
    }

    const [modalVisible, setModalVisible] = useState(false);

    const handleOpenModal = () => {
        setModalVisible(true);
    };

    const handleCloseModal = () => {
        setModalVisible(false);
    };

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        !queue.length ? (
            <div className={style.queuePage}>
                <div className={style.iconsTop}>
                    <div className={style.inst} onClick={handleClick}>
                        <img src={`${mainActive}`} alt='инструкция'/>
                    </div>
                </div>
                <Header/>
                <div className={style.info}>
                    <div className={style.pageName}>
                        Отложенные
                    </div>
                    <div onClick={handleClick} className={style.paymentBtn}>
                        Вернуться
                    </div>
                </div>
            </div>
        ) : (
            <div className={style.queuePage}>
                <div className={style.iconsTop}>
                    <div className={style.inst} onClick={handleClick}>
                        <img src={`${mainActive}`} alt='инструкция'/>
                    </div>
                </div>
                <Header/>
                <Modal isOpen={modalVisible} onClose={handleCloseModal}/>
                <div className={style.info}>
                    <div className={style.pageName}>
                        Отложенные
                    </div>
                    <div className={style.paymentBtn} onClick={handleOpenModal}>
                        Оплатить все
                    </div>
                </div>
                <div className={style.queue}>
                    {queue.map((item) => (
                        <ContentCardBig item={item}/>
                    ))}
                </div>
            </div>
        )
    );
};
export default QueuePage