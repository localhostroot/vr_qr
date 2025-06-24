import style from './contentcardpaid.module.scss'
import sendRequest from "../../../../features/api/sendRequest.js";
import {formatTime} from "@/features/utils/playbackUtils.js";
import {AddToQueueBtn} from "@/shared/components/AddToQueueBtn/AddToQueueBtn.jsx";
import {QueueButton} from "../QueueButton/QueueButton.jsx";
import useContentCardState from "../../../../features/hooks/useContentCardState.js";




export const ContentCardPaid = ({item, clientId, location, client}) => {
    const type = 'videoForClient'
    const {
        isActive,
        isPending,
        isInQueue,
        isOtherActive,
    } = useContentCardState(client, item);


    const handleWatchClick = () => {
        sendRequest(clientId, location, type, item.film_id)
            .then(() => {
                console.log('Запрос на просмотр отправлен.');
            })
            .catch((error) => {
                console.error('Ошибка при отправке запроса:', error);
                alert(`Произошла ошибка: ${error.message}`);
            });
    };

    const handleStop = () => {
        sendRequest(clientId, location, 'stop', item.film_id)
    };

    const handleAddToQueue = () => {
        sendRequest(clientId, location, 'addToQueue', item.film_id)
    };

    const handleRemoveFromQueue = () => {
        sendRequest(clientId, location, 'removeFromQueue', item.film_id)
    };
    const handleCleanQueue = () => {
        sendRequest(clientId, location, 'clean')
    };



    const formattedPlaybackPosition = client && client.playbackPosition ? formatTime(client.playbackPosition) : '00:00';


    return (
        <div className={style.contentCard}>
            <div
                className={style.afisha}
            >
                <img className={style.paidAfisha}
                     src={item.queueImg}
                     alt='покупки'
                />
                <div className={style.afishaInfo}>
                    <div className={style.format}>
                        {item.format}
                    </div>
                    <div className={style.btnWrapper}>
                        <AddToQueueBtn item={item}/>
                    </div>
                    <div className={style.afishaBottomInfo}>
                        <div className={style.time}>
                            {item.time}
                        </div>
                    </div>
                </div>
            </div>
            <div className={style.bottomInfo}>
                <div className={style.name}>{item.name}</div>
                <QueueButton
                    isActive={isActive}
                    isPending={isPending}
                    isInQueue={isInQueue}
                    isOtherActive={isOtherActive}
                    handleWatchClick={handleWatchClick}
                    handleAddToQueue={handleAddToQueue}
                    handleRemoveFromQueue={handleRemoveFromQueue}
                    handleStop={handleStop}
                    formattedPlaybackPosition={formattedPlaybackPosition}
                    item={item}
                    client={client}
                    handleCleanQueue={handleCleanQueue}
                />
            </div>
        </div>
    )
}