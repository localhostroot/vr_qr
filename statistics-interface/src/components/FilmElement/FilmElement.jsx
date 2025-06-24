import style from './filmelement.module.css'



export const FilmElement = ({film}) => {


    return (
        <div className={style.filmElement} style={{backgroundImage: `url(${film.img})`}}>
            <div className={style.title}>
                {film.title}
            </div>
            <div className={style.views}>
                Просмотров: {film.views}
            </div>
        </div>
    )
}