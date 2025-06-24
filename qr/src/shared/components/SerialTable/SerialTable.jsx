import style from './serialtable.module.scss'
import {TableElement} from "@/shared/components/TableElement/TableElement.jsx";




export const SerialTable = ({item, series}) => {



    return (
        <div className={style.serialTable}>
            <div className={style.header}>
                <div className={style.name}>
                    ВСЕ СЕРИИ
                </div>
                <div className={style.series}>
                    {series}
                </div>
            </div>
            <div className={style.list}>
                {item.map((i) => (
                    <TableElement item={i} />
                ))}
            </div>
        </div>
    )
}