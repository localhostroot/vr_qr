import React from 'react';
import style from './modal.module.scss';
import btnClose from '@/assets/images/buttonClose.svg';
import usePaykeeperPayment from "../../../../features/hooks/usePaykeeperPayment.js";

export const Modal = ({ isOpen, onClose }) => {
    const clientString = localStorage.getItem('client');
    const client = clientString ? JSON.parse(clientString) : null;
    const clLocation = client?.location || null;
    const id = client?.id || null;
    const userId = clLocation && id ? `${clLocation}/${id}` : null;

    const databaseApi = import.meta.env.VITE_REACT_APP_DATABASE;



    const { handlePaymentClick, error } = usePaykeeperPayment(databaseApi, userId);

    if (!isOpen) return null;



    return (
        <div className={style.modalOverlay}>
            <div className={style.modalContent}>
                <button className={style.modalCloseButton} onClick={onClose}>
                    <img src={`${btnClose}`} alt={'выход'}/>
                </button>
                <div className={style.instructions}>
                    <div className={style.instEl}>
                        <div className={style.number}>
                            1.
                        </div>
                        <div className={style.descr}>
                            Оплата является окончательной и не подлежит возврату. Деньги не возвращаются, вне зависимости от того, был ли фильм просмотрен полностью, частично или не начат вовсе.
                        </div>
                    </div>
                    <div className={style.instEl}>
                        <div className={style.number}>
                            2.
                        </div>
                        <div className={style.descr}>
                            Ваше право на выбор — досматривать фильм или нет. Вы вправе не досматривать выбранный фильм до конца, если по какой-либо причине он не соответствует вашим ожиданиям. Это не предусматривает возврата оплаченной суммы.
                        </div>
                    </div>
                    <div className={style.instEl}>
                        <div className={style.number}>
                            3.
                        </div>
                        <div className={style.descr}>
                            Возможно перейти к следующему фильму, не досматривая текущий при наличии оплаченного доступа.
                        </div>
                    </div>
                    <div className={style.instEl}>
                        <div className={style.number}>
                            4.
                        </div>
                        <div className={style.descr}>
                            После просмотра всех фильмов, включенных в вашу оплату, система автоматически переходит в режим ожидания. Для активации доп.  доступа вам необходимо сканировать новый QR.
                        </div>
                    </div>
                    <div className={style.instEl}>
                        <div className={style.number}>
                            5.
                        </div>
                        <div className={style.descr}>
                            Если у вас возникнут дополнительные вопросы или сложности, наш администратор всегда готов помочь.
                        </div>
                    </div>
                </div>
                <div className={style.grace}>
                    Благодарим за понимание и желаем приятного просмотра!
                </div>
                <div className={style.payBtn} onClick={handlePaymentClick}>
                    Оплата
                </div>
                <div className={style.agreement}>
                    Нажимая на "Оплатить", вы соглашаетесь с условиями просмотра.
                </div>
                {error && (<div>{error}</div>)}
            </div>
        </div>
    );
};