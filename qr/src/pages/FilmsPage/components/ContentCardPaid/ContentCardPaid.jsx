import style from './contentcardpaid.module.scss'
import {useDispatch, useSelector} from "react-redux";
import sendRequest from "../../../../features/paidApi/sendRequest.js";
import {useState} from "react";
import {formatTime} from "@/features/utils/playbackUtils.js";
import useContentCardState from "../../../../features/hooks/useContentCardState.js";
import {QueueButton} from "../QueueButton/QueueButton.jsx";
import useTokenValidation from '../../../../features/hooks/useTokenValidation.js';

export const ContentCardPaid = ({item, clientId, location, client}) => {
  const dispatch = useDispatch();
  const type = 'videoForClient';
  const databaseApi = import.meta.env.VITE_REACT_APP_DATABASE;
  const token = useSelector(state => state.token.token);
  
  const { isValidToken, isValidFilm, isLoading } = useTokenValidation(
    databaseApi, 
    item.film_id, 
    item.id  
  );
  
  const [requestError, setRequestError] = useState(null);

  const {
    isActive,
    isPending,
    isInQueue,
    isOtherActive,
  } = useContentCardState(client, item);

  if (!isLoading && (!isValidToken || !isValidFilm)) {
    return null;
  }

  const handleWatchClick = async () => {
    if (!isValidToken || !isValidFilm) {
      setRequestError("Нет доступа к этому фильму. Возможно, токен истек или не действителен.");
      return;
    }   

    try {
      await sendRequest(clientId, location, type, item.film_id, token);
      setRequestError(null);
    } catch (error) {
      setRequestError(`Произошла ошибка: ${error.message}`);
    }
  };

  const handleStop = async () => {
    if (!isValidToken) {
      setRequestError("Недействительный токен доступа.");
      return;
    }
    
    try {
      await sendRequest(clientId, location, 'stop', item.film_id, token);
      setRequestError(null);
    } catch (error) {
      setRequestError(`Произошла ошибка: ${error.message}`);
    }
  };

  const handleAddToQueue = async () => {
    if (!isValidToken || !isValidFilm) {
      setRequestError("Нет доступа к этому фильму. Возможно, токен истек или не действителен.");
      return;
    }
    try {
      await sendRequest(clientId, location, 'addToQueue', item.film_id, token);
      setRequestError(null);
    } catch (error) {
      setRequestError(`Произошла ошибка: ${error.message}`);
    }
  };

  const handleRemoveFromQueue = async () => {
    if (!isValidToken) {
      setRequestError("Недействительный токен доступа.");
      return;
    }
    
    try {
      await sendRequest(clientId, location, 'removeFromQueue', item.film_id, token);
      setRequestError(null);
    } catch (error) {
      setRequestError(`Произошла ошибка: ${error.message}`);
    }
  };
  
  const handleCleanQueue = async () => {
    if (!isValidToken) {
      setRequestError("Недействительный токен доступа.");
      return;
    }
    
    try {
      await sendRequest(clientId, location, 'clean', null, token);
      setRequestError(null);
    } catch (error) {
      setRequestError(`Произошла ошибка: ${error.message}`);
    }
  };

  const formattedPlaybackPosition = client && client.playbackPosition ? formatTime(client.playbackPosition) : '00:00';

  return (
    <div className={style.contentCard}>
      {isLoading ? (
        <div className={style.loading}>Проверка доступа...</div>
      ) : (
        <>
          <div className={style.afisha}>
            <img className={style.paidAfisha}
                src={item.queueImg}
                alt='покупки'
            />
            <div className={style.afishaInfo}>
              <div className={style.format}>
                {item.format}
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
            
            {isValidToken && isValidFilm ? (
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
            ) : (
              <div className={style.accessDenied}>
                Нет доступа к фильму
              </div>
            )}
          </div>

          {requestError && (
            <div className={style.error}>
              {requestError}
            </div>
          )}
        </>
      )}
    </div>
  );
};