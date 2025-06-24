import style from './leftupperbody.module.scss'


export const LeftUpperBody = () => {


    return (
        <div className={style.leftUpperBody}>
            <div className={style.name}>
                4 Neba VR
            </div>
            <div className={style.initInstructions}>
                <div className={style.firstParagraph}>
                    учись и путешествуй в виртуальной реальности.
                </div>
                <div className={style.secondParagraph}>
                    выбери фильм, оплати, и наслаждайся просмотром
                </div>
            </div>
        </div>
    )
}