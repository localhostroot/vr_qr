import React, { useState } from 'react';
import style from './notimodal.module.css';

const NotiModal = ({ isOpen, onClose, onSubmit }) => {
    const [message, setMessage] = useState('');

    const handleChange = (event) => {
        setMessage(event.target.value);
    };

    const handleSubmit = () => {
        onSubmit(message);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className={style.modal}>
            <div className={style.modalContent}>
                <input type="text" value={message} onChange={handleChange} />
                <button onClick={handleSubmit}>Отправить</button>
                <button onClick={onClose}>Отменить</button>
            </div>
        </div>
    );
};

export default NotiModal;