import style from './instructionmodal.module.scss'
import btnClose from "@/assets/images/buttonClose.svg";
import inst from '@/assets/images/i.svg'


export const InstructionModal = ({ isOpen, onClose}) => {


    if (!isOpen) return null;


    return (
        <div className={style.modalOverlay}>
            <div className={style.modalContent}>
                <button className={style.modalCloseButton} onClick={onClose}>
                    <img src={`${btnClose}`} alt={'выход'}/>
                </button>
                <div className={style.inst}>
                    <img src={`${inst}`} alt='prescription'/>
                </div>
                <div className={style.instructions}>
                    <div className={style.instEl}>
                        <div className={style.number}>
                            1.
                        </div>
                        <div className={style.descr}>
                            После оплаты наденьте шлем с вашим qr для разблокировки экрана.
                        </div>
                    </div>
                    <div className={style.instEl}>
                        <div className={style.number}>
                            2.
                        </div>
                        <div className={style.descr}>
                            Перед вами появится красная точка управляемая движением головы.
                        </div>
                    </div>
                    <div className={style.instEl}>
                        <div className={style.number}>
                            3.
                        </div>
                        <div className={style.descr}>
                            Наведите красную точку на кнопку «Начать просмотр».
                            Наслаждайтесь просмотром!
                        </div>
                    </div>
                    <div className={style.instEl}>
                        <div className={style.number}>
                            4.
                        </div>
                        <div className={style.descr}>
                            Запускайте фильмы с телефона, они будут доступны 2 часа.
                        </div>
                    </div>
                    <div className={style.instEl}>
                        <div className={style.number}>
                            5.
                        </div>
                        <div className={style.descr}>
                            По окончанию просмотра, аккуратно снимите шлем и отдайте администратору.
                        </div>
                    </div>
                </div>
                <div className={style.grace}>
                    Вы можете начать просмотр с вашего телефона, нажав на кнопку «Просмотр» и аккуратно надеть шлем.
                </div>
                <div className={style.grace}>
                    Если при просмотре фильма перед глазами мешающий экран-блокировки, на телефоне нажмите на кнопку «Сбросить».
                </div>
            </div>
        </div>
    );
};