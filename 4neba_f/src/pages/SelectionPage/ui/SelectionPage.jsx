import style from './selectionpage.module.scss'
import {useNavigate} from "react-router";
import {useSelector} from "react-redux";
import {Header} from "@/widgets/Header/index.js";
import logo from '@/assets/images/smallLogo.svg'


const SelectionPage = () => {
    const navigate = useNavigate()
    const clients = useSelector((state) => state.clients.clients);


    return (
        clients && clients.length > 0 &&
            ( <div className={style.wrapper}>
                    <Header/>
                    <div className={style.vrList}>
                        {clients.map((item, index) => (
                            <div className={style.vrItem} onClick={() => navigate(`/vr/${item.location}/${item.id}`)} key={index}>
                                <img className={style.logo} src={logo} alt={"очки"}/>
                                <div className={style.number}>{item.location}:{item.id}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )
    );
}
export default SelectionPage