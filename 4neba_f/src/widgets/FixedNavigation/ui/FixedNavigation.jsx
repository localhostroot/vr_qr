import React from 'react';
import { Link } from 'react-router-dom';
import style from './fixednavigation.module.scss';
import main from '@/assets/images/main.svg';
import que from '@/assets/images/basket.svg';
import queActive from '@/assets/images/basketActive.svg';
import mainActive from '@/assets/images/mainActive.svg';
import { useLocation } from "react-router";
import { useSelector } from "react-redux";

function FixedNavigation() {
    const location = useLocation();
    const clientString = localStorage.getItem('client');
    const client = clientString ? JSON.parse(clientString) : null;
    const clLocation = client?.location || null;
    const id = client?.id || null;
    const userId = clLocation && id ? `${clLocation}/${id}` : null;
    const hideNavAndFooter = location.pathname === '/';

    const queue = useSelector((state) => state.queue.queue);
    return (
        !hideNavAndFooter && (
            <nav className={style.fixedNavigation}>
                <div>
                    <Link to={userId ? `/vr/${userId}` : '/vr'}>
                        <img src={location.pathname.startsWith('/vr/') ? mainActive : main} alt='main' />
                    </Link>
                </div>
                <div>
                    <Link to="/queue">
                        <img src={location.pathname === '/queue' ? queActive : que} alt='queue' />
                    </Link>
                    {queue && queue.length > 0 && <div className={style.queue}>{queue.length}</div>}
                </div>
            </nav>
        )
    );
}

export default FixedNavigation;