import React, { useState, useEffect } from 'react';
import style from './statspage.module.css';
import { CategoriesList } from "../../components/CategoriesList/CategoriesList";
import {LocationList} from "../../components/LocationsList/LocationList";
import {useResponsive} from "../../utils/responsiveContext";

export const StatsPage = () => {
    const [categories, setCategories] = useState([]);
    const [totalStats, setTotalStats] = useState({ total_views: 0, todays_views: 0 });
    const [locations, setLocations] = useState([]);
    const API_BASE_URL = process.env.REACT_APP_STATS_DATABASE;

    const { isPhone, isTablet, isDesktop } = useResponsive()

    useEffect(() => {
        const fetchCategories = async () => {
            const token = localStorage.getItem('token');
            try {
                const response = await fetch(`${API_BASE_URL}api/categories/`, {
                    headers: {
                        'Authorization': `Token ${token}`
                    }
                });
                if (!response.ok) {
                    throw new Error('Не удалось получить категории');
                }
                const data = await response.json();
                setCategories(data);
            } catch (error) {
                console.error('Ошибка категории:', error);
            }
        };

        const fetchTotalStats = async () => {
            const token = localStorage.getItem('token');
            try {
                const response = await fetch(`${API_BASE_URL}api/total_stats/`, {
                    headers: {
                        'Authorization': `Token ${token}`
                    }
                });
                if (!response.ok) {
                    throw new Error('ошибка статистика');
                }
                const data = await response.json();
                setTotalStats(data);
            } catch (error) {
                console.error('ошибка статистика:', error);
            }
        };

        const fetchLocations = async () => {
            const token = localStorage.getItem('token');
            try {
                const response = await fetch(`${API_BASE_URL}api/locations/`, {
                    headers: {
                        'Authorization': `Token ${token}`
                    }
                });
                if (!response.ok) {
                    throw new Error('ошибка локации');
                }
                const data = await response.json();
                console.log(data)
                setLocations(data);
            } catch (error) {
                console.error('ошибка локация:', error);
            }
        };

        fetchCategories();
        fetchTotalStats();
        fetchLocations();
    }, []);

    return (
        <div className={style.StatsPage}>
            <div className={`${isPhone ? style.upperPhone :style.upper}`}>
                <div className={style.totalViews}>
                    <div>Всего просмотров: {totalStats.total_views}</div>
                    <div>Просмотров сегодня: {totalStats.todays_views}</div>
                </div>
            <LocationList locations={locations}/>
            </div>
            <CategoriesList categories={categories} />
        </div>
    );
};