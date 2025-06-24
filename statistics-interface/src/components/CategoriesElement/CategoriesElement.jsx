import style from './categorieselement.module.css'
import {FilmsList} from "../FilmsList/FilmsList";
import {useEffect, useState} from "react";
import {useResponsive} from "../../utils/responsiveContext";



export const CategoriesElement = ({category}) => {
    const [films, setFilms] = useState([]);
    const API_BASE_URL = process.env.REACT_APP_STATS_DATABASE;

    const { isPhone, isTablet, isDesktop } = useResponsive()


    useEffect(() => {
        const fetchFilms = async () => {
            const token = localStorage.getItem('token');
            try {
                const response = await fetch(`${API_BASE_URL}api/videos/?category=${category.name}`, {
                    headers: {
                        'Authorization': `Token ${token}`
                    }
                });
                if (!response.ok) {
                    throw new Error('ошибка фильмов');
                }
                const data = await response.json();
                console.log(data)
                setFilms(data);
            } catch (error) {
                console.error('Ошибка при получении фильмов:', error);
            }
        };

        fetchFilms();
    }, [category.id]);

    return (
        <div className={`${isPhone ? style.categoriesElementPhone : style.categoriesElement}`}>
            <h3>{category.name}</h3>
            <FilmsList films={films}/>
        </div>
    )
}