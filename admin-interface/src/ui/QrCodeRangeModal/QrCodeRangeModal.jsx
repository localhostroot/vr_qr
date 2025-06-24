import React, { useState } from 'react';
import style from './qrcoderangemodal.module.css'

const QrCodeRangeModal = ({ isOpen, onClose, onSubmit }) => {
    const [range, setRange] = useState("");

    const handleSubmit = () => {
        if (range) {
            const numbers = range.split("-").map((num) => parseInt(num.trim(), 10));

            if (numbers.length === 1 && !isNaN(numbers[0])) {
                const singleValue = numbers[0];
                onSubmit({ min: singleValue, max: singleValue });
                onClose();
            } else if (numbers.length === 2 && !isNaN(numbers[0]) && !isNaN(numbers[1]) && numbers[0] <= numbers[1]) {
                onSubmit({ min: numbers[0], max: numbers[1] });
                onClose();
            } else {
                alert("Некорректный формат. Введите одно число или диапазон в формате 'min - max', где min и max - целые числа, и min <= max.");
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className={style.modal}>
            <div className="modal-content">
                <h2>диапазон id для кодов</h2>
                <div className={style.input}>
                    <label>id или диапазон</label>
                    <input
                        type="text"
                        value={range}
                        onChange={(e) => setRange(e.target.value)}
                        placeholder="Пример: 1 или 1 - 10"
                    />
                </div>
                <button onClick={handleSubmit}>Создать QR-коды</button>
                <button style={{ marginLeft: "10px" }} onClick={onClose}>
                    Отмена
                </button>
            </div>
        </div>
    );
};

export default QrCodeRangeModal;