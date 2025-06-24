import React, { useState, useEffect } from 'react';
import style from './statblock.module.css';
import {useResponsive} from "../../utils/ResponsiveContext";

export const StatBlock = ({ location }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [movieStats, setMovieStats] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const { isPhone, isTablet, isDesktop } = useResponsive()

    useEffect(() => {
        fetchMovieStats();
    }, [location]);

    const fetchMovieStats = async () => {
        setLoading(true);
        setError(null);

        let url = `${process.env.REACT_APP_ADMIN_DATABASE}movie_stats/?location_id=${location}`;

        if (startDate) {
            url += `&start_date=${startDate}`;
        }
        if (endDate) {
            url += `&end_date=${endDate}`;
        }

        try {
            const token = localStorage.getItem('token');

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`,
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    console.error('Неверный токен. Требуется повторная авторизация.');
                }
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            setMovieStats(data);
            console.log(data)
        } catch (error) {
            console.error("Error fetching movie stats:", error);
            setError(error.message || "Произошла ошибка при загрузке статистики.");
        } finally {
            setLoading(false);
        }
    };

    const handleStartDateChange = (e) => {
        setStartDate(e.target.value);
    };

    const handleEndDateChange = (e) => {
        setEndDate(e.target.value);
    };

    const handleApplyDateFilter = () => {
        fetchMovieStats();
    };

    return (
        movieStats &&
        <div
            className={`${isDesktop && style.statsContainer} 
            ${isTablet && style.statsContainerTablet}
            ${isPhone && style.statsContainerPhone}`}
        >
            <h2>
                Количество просмотров
            </h2>
            <div className={style.funcsBtn}>
                <div className={style.funcs}>
                    <div>
                        <input placeholder='дата' type="date" value={startDate} onChange={handleStartDateChange}/>
                    </div>
                    <div>
                        <input placeholder='дата' type="date" value={endDate} onChange={handleEndDateChange}/>
                    </div>
                </div>
                <button onClick={handleApplyDateFilter}>Фильтровать</button>
            </div>
            <div className={style.movieList}>
                {movieStats.map((movie) => (
                    <div key={movie.movie_id} className={style.movieItem}>
                        <img src={`${movie.movie_image}`} alt={movie.movie_title} className={style.movieImage} />
                        <h3>{movie.movie_title}</h3>
                        <p>Просмотров: {movie.total_views}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};