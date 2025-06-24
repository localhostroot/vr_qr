import React, { useState, useEffect } from 'react';
import style from './filmformadmin.module.css';

const FilmFormAdmin = ({ onChange }) => {
    const [title, setTitle] = useState('');
    const [video_id, setVideoId] = useState('');
    const [image, setImage] = useState(null);
    const [timer, setTimer] = useState('10:00');

    useEffect(() => {
        onChange({ title, video_id, image, timer });
    }, [title, video_id, image, timer, onChange]);

    const handleImageChange = (e) => {
        setImage(e.target.files[0]);
    };

    return (
        <div className={style.filmFormAdmin}>
            <h3>Форма для Admin</h3>
            <label htmlFor="title">Title:</label>
            <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
            />
            <label htmlFor="video_id">Video ID:</label>
            <input
                type="text"
                id="video_id"
                value={video_id}
                onChange={(e) => setVideoId(e.target.value)}
            />
            <label htmlFor="image">Image:</label>
            <input
                type="file"
                id="image"
                onChange={handleImageChange}
            />
            <label htmlFor="timer">Timer:</label>
            <input
                type="text"
                id="timer"
                value={timer}
                onChange={(e) => setTimer(e.target.value)}
            />
        </div>
    );
};

export default FilmFormAdmin;