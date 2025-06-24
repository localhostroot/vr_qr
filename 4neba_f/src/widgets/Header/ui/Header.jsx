import style from './header.module.scss'
import logo from '../../../../../qr/src/assets/images/smallLogo.svg'


const Header = () => {


    return (
        <header className={style.header}>
            <img className={style.logo} src={logo} alt="VR-очки"/>
        </header>
    )
}

export default Header