import style from './locationlist.module.css'
import {LocationElement} from "../LocationElement/LocationElement";
import {useResponsive} from "../../utils/responsiveContext";



export const LocationList = ({locations}) => {

    const { isPhone, isTablet, isDesktop } = useResponsive()

    return (
        <div className={`${isDesktop && style.locationList} ${isTablet && style.locationListTablet}
        ${isPhone && style.locationListPhone}`}>
            {
                locations && locations.length > 0 &&
                locations.map((location) => (
                    <LocationElement location={location} />
                ))
            }
        </div>
    )
}