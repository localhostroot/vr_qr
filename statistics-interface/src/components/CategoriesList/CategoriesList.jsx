import style from './categorieslist.module.css'
import {CategoriesElement} from "../CategoriesElement/CategoriesElement";
import {useResponsive} from "../../utils/responsiveContext";



export const CategoriesList = ({categories}) => {

    const { isPhone, isTablet, isDesktop } = useResponsive()

    return (
        <div className={`${isPhone ? style.categoriesListPhone : style.categoriesList}`}>
            {
                categories && categories.length > 1 &&
                categories.map((category) => (
                    <CategoriesElement category={category}/>
                ))
            }
        </div>
    )
}