import React, { useState, useEffect } from 'react';
import style from './filmformstats.module.css';

const FilmFormStats = ({ onChange }) => {
    const [video_id, setVideoId] = useState('');
    const [title, setTitle] = useState('');
    const [category_name, setCategoryName] = useState('');
    const [img, setImg] = useState(null);

    useEffect(() => {
        onChange({ video_id, title, category_name, img });
    }, [video_id, title, category_name, img, onChange]);

    const handleImgChange = (e) => {
        setImg(e.target.files[0]);
    };

    return (
        <div className={style.filmFormStats}>
            <h3>Форма для Stats</h3>
            <label htmlFor="video_id">Video ID:</label>
            <input
                type="text"
                id="video_id"
                value={video_id}
                onChange={(e) => setVideoId(e.target.value)}
            />
            <label htmlFor="title">Title:</label>
            <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
            />
            <label htmlFor="category_name">Category Name:</label>
            <input
                type="text"
                id="category_name"
                value={category_name}
                onChange={(e) => setCategoryName(e.target.value)}
            />
            <label htmlFor="img">Image:</label>
            <input
                type="file"
                id="img"
                onChange={handleImgChange}
            />
        </div>
    );
};

export default FilmFormStats;