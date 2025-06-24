import style from './socials.module.scss'
import vk from "@/assets/images/vk.svg";
import instagram from "@/assets/images/inst.svg";
import telegram from "@/assets/images/telegram.svg";



export const Socials = () => {

    const openNewTab = (url) => {
        window.open(url, '_blank');
    };


    return (
        <div className={style.socials}>
            <h1>Подписаться на нас</h1>
            <div onClick={() => openNewTab("https://vk.com/4neba")} className={style.socialBlock}>
                <img src={vk} alt='vk'/>
                <div>vk.com/4neba</div>
            </div>
            <div onClick={() => openNewTab("https://instagram.com/vr4neba")} className={style.socialBlock}>
                <img src={instagram} alt='instagram'/>
                <div>@vr4neba</div>
            </div>
            <div onClick={() => openNewTab("https://t.me/vr4neba")} className={style.socialBlock}>
                <img src={telegram} alt='telegram'/>
                <div>t.me/vr4neba</div>
            </div>
        </div>
    )
}