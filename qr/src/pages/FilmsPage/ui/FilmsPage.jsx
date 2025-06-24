import style from './filmspage.module.scss'
import {Header} from "../../../../../4neba_f/src/widgets/Header/index.js";
import {useEffect, useState} from "react";
import {useSelector} from "react-redux";
import LOCAL_STORAGE_KEYS from "@/shared/constants/localStorageKeys.js";
import {useNavigate} from "react-router";
import inst from '@/assets/images/i.svg'
import mainActive from '@/assets/images/mainActive.svg'
import {InstructionModal} from "../components/InstructionModal/InstructionModal.jsx";
import {ContentCardPaid} from "../components/ContentCardPaid/ContentCardPaid.jsx";
import sendRequest from "@/features/paidApi/sendRequest.js";
import useClientData from "@/features/hooks/useClientData.js";
import {Socials} from "@/pages/FilmsPage/components/Socials/Socials.jsx";

const FilmsPage = () => {
    const paidFilms = useSelector((state) => state.paidFilms.paidFilms);

    const clientString = localStorage.getItem('client');
    const client = clientString ? JSON.parse(clientString) : null;
    const clLocation = client?.location || null;
    const id = client?.id || null;
    const userId = clLocation && id ? `${clLocation}/${id}` : null;

    const { clientData, loading, error } = useClientData(clLocation, id);
    const type = 'reset'

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        localStorage.setItem(LOCAL_STORAGE_KEYS.PAID_FILMS, JSON.stringify(paidFilms));
    }, [paidFilms]);

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
        !paidFilms.length ? (
            <div className={style.queuePage}>
                <Header/>
                <InstructionModal isOpen={modalVisible} onClose={handleCloseModal} />
                <div className={style.info}>
                    <div className={style.pageName}>
                        Мои покупки
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
                        Мои покупки
                    </div>
                    <div onClick={handleDelete} className={style.paymentBtn}>
                        Сбросить
                    </div>
                </div>
                <div className={style.queue}>
                    {paidFilms.map((item) => (
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
export default FilmsPage