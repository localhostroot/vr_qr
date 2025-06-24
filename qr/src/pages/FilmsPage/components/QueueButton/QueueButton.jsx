import style from './queuebutton.module.scss'

export const QueueButton = ({
                         isActive,
                         isPending,
                         isInQueue,
                         isOtherActive,
                         handleWatchClick,
                         handleAddToQueue,
                         handleRemoveFromQueue,
                         handleStop,
                         formattedPlaybackPosition,
                         item,
                         client,
                         handleCleanQueue,
                     }) => {
    let buttonContent;
    if (isActive) {
        buttonContent = (
            <div className={style.playing}>
                <div className={style.playback}>{formattedPlaybackPosition} / {item.time}</div>
                <div className={style.stop} onClick={handleStop}> Остановить </div>
            </div>
        );
    } else if (isPending && !isOtherActive) {
        buttonContent = (
            <div className={style.takeGlasses}>
                <div className={style.watchSmall}>Наденьте очки</div>
                <div
                    className={style.watchStop}
                    onClick={handleCleanQueue}
                >
                    Отменить
                </div>
            </div>
        );
    }
    else if (isPending && isOtherActive) {
        buttonContent = (
            <div className={style.watch} onClick={handleRemoveFromQueue}>
                Убрать из очереди
            </div>
        );
    }
    else if (isOtherActive && !isInQueue) {
        buttonContent = (
            <div className={style.watch} onClick={handleAddToQueue}>
                Добавить в очередь
            </div>
        );
    }
    else if (!isOtherActive && isInQueue) {
        buttonContent = (
            <div className={style.watch} onClick={handleRemoveFromQueue}>
                Убрать из очереди
            </div>
        );
    }
    else if (isOtherActive && isInQueue) {
        buttonContent = (
            <div className={style.watch} onClick={handleRemoveFromQueue}>
                Убрать из очереди
            </div>
        );
    }
    else if (!isInQueue && client && client.pendingQueue && Array.isArray(client.pendingQueue) && client.pendingQueue.length > 0) {
        buttonContent = (
            <div className={style.watch} onClick={handleAddToQueue}>
                Добавить в очередь
            </div>
        );
    }
    else if (isInQueue && !isActive && !isPending) {
        buttonContent = (
            <div className={style.watch} onClick={handleRemoveFromQueue}>
                Убрать из очереди
            </div>
        );
    }
    else {
        buttonContent = (
            <div className={style.watch} onClick={handleWatchClick}>
                Смотреть
            </div>
        );
    }
    return buttonContent;
};
