import React, { useState, useEffect } from 'react';
import style from './singlemovieitem.module.scss';
import { RiArrowGoBackFill } from "react-icons/ri";
import arrow from '@/assets/images/arrow.svg';
import { MovieBottomInfo } from "../MovieBottomInfo/MovieBottomInfo.jsx";
import { SerialTable } from "../SerialTable/SerialTable.jsx";
import { useNavigate } from 'react-router-dom';
import Loader from "@/widgets/Loader/Loader.jsx";

export const SingleMovieItem = ({ item, list, itemRouteId }) => {

    const navigate = useNavigate();
    const clientString = localStorage.getItem('client');
    const client = clientString ? JSON.parse(clientString) : null;
    const clLocation = client?.location || null;
    const id = client?.id || null;
    const userId = clLocation && id ? `${clLocation}/${id}` : null;

    const [imageLoading, setImageLoading] = useState(true);

    const handleClick = () => {
        navigate(-1);
    };

    const handleReverseClick = () => {
        if (!item || !item.cat_id || !item.cat_id.cat_id || !list || list.length === 0) {
            return;
        }

        const filteredList = list.filter(listItem => {
            return listItem && listItem.cat_id && listItem.cat_id.cat_id === item.cat_id.cat_id;
        });

        if (filteredList.length === 0) {
            return;
        }

        const currentIndex = filteredList.findIndex(listItem => listItem.id === item.id);

        if (currentIndex === -1) {
            return;
        }

        let nextItem;
        if (currentIndex + 1 < filteredList.length) {
            nextItem = filteredList[currentIndex + 1];
        } else {
            nextItem = filteredList[0];
        }

        if (nextItem) {
            navigate(`/film/${nextItem.route_id}`);
        }
    };

    const handleClickReturn = () => {
        navigate(`/content/${itemRouteId}`)
    }

    useEffect(() => {
        const img = new Image();
        img.src = item.backImg;

        img.onload = () => {
            setImageLoading(false);
        };

        img.onerror = () => {
            console.error("Не удалось загрузить изображение", item.backImg);
            setImageLoading(false);
        };

    }, [item.backImg]);

    return imageLoading ? (
        <Loader />
    ) : (
        <div className={style.singleMovie}>
            <div className={style.upperInfo}>
                <img
                    className={style.back}
                    alt='афиша'
                    src={item.backImg}
                />
                <div onClick={item.serial ? () => navigate(userId ? `/vr/${userId}` : `/`) : handleClick}
                     className={style.btn}>
                    <img src={`${arrow}`} alt='1234'/>
                </div>
                {item.series && !item.serial && (
                    <div onClick={handleReverseClick} className={style.btnReverse}>
                        <img src={`${arrow}`} alt='1235'/>
                    </div>
                )}
                {item.series && !item.serial && (
                    <div onClick={handleClickReturn} className={style.btnReturn}>
                        <RiArrowGoBackFill color='rgba(255,255,255, 0.75)'/>
                    </div>
                )}
            </div>
            {item.serial
                ? (
                    <div className={style.serialInfo}>
                        <MovieBottomInfo item={item}/>
                        <SerialTable item={list} series={item.series}/>
                    </div>
                )
                : (
                    <MovieBottomInfo item={item}/>
                )
            }
        </div>
    )
}