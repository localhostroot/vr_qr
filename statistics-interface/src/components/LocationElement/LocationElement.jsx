import style from './locationelement.module.css'
import {useState} from "react";
import LocationModal from "../../ui/LocationModal/LocationModal";
import {useResponsive} from "../../utils/responsiveContext";



export const LocationElement = ({location}) => {
    console.log(JSON.stringify(location) + "Location")
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { isPhone, isTablet, isDesktop } = useResponsive()

    const openModal = () => {
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };


    return (
        <div className={`${isPhone ? style.locationElementPhone :style.locationElement}`}>
            <h3>{location.name}</h3>
            <div className={style.views}>
                <div>Просмотров: {location.views}</div>
                <div>Просмотров сегодня: {location.todays_views}</div>
            </div>
            <button onClick={openModal} className={style.openModalBtn}> Посмотреть </button>
            {isModalOpen && (
                <LocationModal location={location} onClose={closeModal} />
            )}
        </div>
    )
}