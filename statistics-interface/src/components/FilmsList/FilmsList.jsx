import style from './filmslist.module.css'
import {FilmElement} from "../FilmElement/FilmElement";



export const FilmsList = ({films}) => {
    console.log(films)

    return (
        <div className={style.filmList}>
            {
                films && films.length > 0 &&
                films.map((film) => (
                    <FilmElement film={film}/>
                ))
            }
        </div>
    )
}