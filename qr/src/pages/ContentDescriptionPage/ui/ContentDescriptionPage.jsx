import style from './contentdescriptionpage.module.scss'
import {useEffect} from "react";
import {useParams} from "react-router";
import {SingleMovieItem} from "@/shared/components/SingleMovieItem/SingleMovieItem.jsx";
import useFetchItem from "@/features/hooks/useFetchItem.js";
import useFetchList from "@/features/hooks/useFetchList.js";


const ContentDescriptionPage = () => {
    const { id } = useParams();
    const databaseApi = import.meta.env.VITE_REACT_APP_DATABASE;

    const { item, loading: itemLoading, error: itemError } = useFetchItem(
        `${databaseApi}api/category/`,
        id,
        'category'
    );

    const { list, loading: listLoading, error: listError } = useFetchList(
        `${databaseApi}api/movie/`
    );

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [id]);

    const filmsList = item ? list.filter((listFilm) => listFilm.cat_id && listFilm.cat_id.cat_id === item.cat_id) : [];

    if (itemLoading || listLoading) {
        return <></>;
    }

    if (itemError || listError) {
        return <>{itemError?.message || listError?.message}</>;
    }

    return (
        <div className={style.contentDescrPage}>
            {item && (
                <SingleMovieItem
                    item={item}
                    list={filmsList}
                    itemRouteId={item.route_id}
                />
            )}
        </div>
    );
};

export default ContentDescriptionPage;

