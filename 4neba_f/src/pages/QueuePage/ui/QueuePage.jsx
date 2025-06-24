import style from './queuepage.module.scss'
import {Header} from "@/widgets/Header/index.js";
import {useEffect, useState} from "react";
import {useSelector} from "react-redux";
import {useNavigate} from "react-router";
import inst from '@/assets/images/i.svg'
import {InstructionModal} from "../components/InstructionModal/InstructionModal";
import {ContentCardPaid} from "../components/ContentCardPaid/ContentCardPaid";
import sendRequest from "../../../features/api/sendRequest.js";
import useClientData from "../../../features/hooks/useClientData.js";
import {Socials} from "../components/Socials/Socials.jsx";
import mainActive from '@/assets/images/mainActive.svg';

const QueuePage = () => {
    const queue = useSelector((state) => state.queue.queue);


    const clientString = localStorage.getItem('client');
    const client = clientString ? JSON.parse(clientString) : null;
    const clLocation = client?.location || null;
    const id = client?.id || null;
    const userId = clLocation && id ? `${clLocation}/${id}` : null;

    const { clientData, loading, error} = useClientData(clLocation, id);
    const type = 'reset'

    console.log(clientData)

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);


    const navigate = useNavigate()

    const handleClick = () => {
        if (userId) {
            navigate(`/vr/${userId}`)
        } else {
            navigate('/vr')
        }
    }

    const handleDelete = () => {
        sendRequest(id, clLocation, type)
    };

    const [modalVisible, setModalVisible] = useState(false);

    const handleOpenModal = () => {
        setModalVisible(true);
    };

    const handleCloseModal = () => {
        setModalVisible(false);
    };


    return (
        !queue.length ? (
            <div className={style.queuePage}>
                <Header/>
                <InstructionModal isOpen={modalVisible} onClose={handleCloseModal} />
                <div className={style.info}>
                    <div className={style.pageName}>
                        Корзина
                    </div>
                    <div onClick={handleClick} className={style.paymentBtn}>
                        Вернуться
                    </div>
                </div>
                <Socials/>
            </div>
        ) : (
            <div className={style.queuePage}>
                <div className={style.iconsTop}>
                    <div className={style.inst} onClick={handleClick}>
                        <img src={`${mainActive}`} alt='инструкция'/>
                    </div>
                    <div className={style.inst} onClick={handleOpenModal}>
                        <img src={`${inst}`} alt='инструкция'/>
                    </div>
                </div>
                <Header/>
                <InstructionModal isOpen={modalVisible} onClose={handleCloseModal}/>
                <div className={style.info}>
                    <div className={style.pageName}>
                        Корзина
                    </div>
                    <div onClick={handleDelete} className={style.paymentBtn}>
                        Сбросить
                    </div>
                </div>
                <div className={style.queue}>
                    {queue.map((item) => (
                        <ContentCardPaid
                            item={item}
                            location={clLocation}
                            clientId={id}
                            client={clientData}/>
                    ))}
                </div>
                <Socials/>
            </div>
        )
    )
}
export default QueuePage