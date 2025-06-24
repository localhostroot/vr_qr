import style from './serialfilmpage.module.scss'
import {SingleMovieItem} from "@/shared/components/SingleMovieItem/SingleMovieItem.jsx";
import {useParams} from "react-router";
import {useEffect} from "react";
import useFetchItem from "@/features/hooks/useFetchItem.js";
import useFetchList from "@/features/hooks/useFetchList.js";


const SerialFilmPage = () => {
    const { id } = useParams();
    const databaseApi = import.meta.env.VITE_REACT_APP_DATABASE;

    const { item, loading: itemLoading, error: itemError } = useFetchItem(
        `${databaseApi}api/movie/`,
        id,
        'movie'
    );

    const { list, loading: listLoading, error: listError } = useFetchList(
        `${databaseApi}api/movie/`
    );

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [id]);

    const filmsList = item ? list.filter((listFilm) => listFilm.cat_id && listFilm.cat_id.cat_id === item.cat_id.cat_id) : [];

    if (itemLoading || listLoading) {
        return <></>;
    }

    if (itemError || listError) {
        return <>{itemError?.message || listError?.message}</>;
    }

    return (
        <div className={style.serialFilmPage}>
            {item && (
                <SingleMovieItem
                    item={item}
                    list={filmsList}
                    itemRouteId={item.cat_id.route_id}
                />
            )}
        </div>
    );
};

export default SerialFilmPage;