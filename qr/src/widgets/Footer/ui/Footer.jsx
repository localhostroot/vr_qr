import React from 'react';
import style from './footer.module.scss'
import {useLocation} from "react-router-dom";

import paykeeper from '@/assets/images/paykeeper.svg'
import visa from '@/assets/images/visa.svg'
import mastercard from '@/assets/images/mastercard.svg'
import mir from '@/assets/images/мир.svg'
import sbp from '@/assets/images/сбп.svg'



function Footer() {
    const location = useLocation();
    const hideNavAndFooter = location.pathname === '/';
    return (
        !hideNavAndFooter &&
        <footer className={style.footer}>
            <div className={style.info}>
                <div>ООО “4 НЕБА ВР”</div>
                <div>+7 926 263 16 19</div>
            </div>
            <div className={style.info}>
                <div className={style.address}>г. Москва, вн. тер. г. Муниципальный Округ Новокосино, ул. Новокосинская, д. 23 111673</div>
                <div>ИНН 7720942745</div>
            </div>
            <div className={style.logos}>
                <img src={paykeeper} alt="Paykeeper" />
                <img src={visa} alt="VISA" />
                <img src={mastercard} alt="Mastercard" />
                <img src={mir} alt="МИР" />
                <img src={sbp} alt="СБП" />
            </div>
        </footer>
    );
}

export default Footer;